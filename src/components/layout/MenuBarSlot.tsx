import { unstable_rethrow } from "next/navigation";
import { AppMenuBar } from "@/components/layout/AppMenuBar";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";

/**
 * #901（2026-10-17）: メニューバーを出すために**ログイン状態だけ**を見る部分。
 *
 * 【初心者向け】ここは `src/app/layout.tsx`（全ページ共通）の中にありました。
 * ところが Cookie を読むところが **`<Suspense>` の外**にあったため、Next.js は
 * **どのページの器も静的に作れません**でした（器を作る時点ではまだ Cookie が無い）。
 *
 * `cacheComponents` を入れたとき、**96 ページのうち最初の 1 枚でビルドが止まった**のがここです。
 * 切り出して `<Suspense>` の中に入れると、**器は関数を呼ばずに配れる**ようになり、
 * メニューバーだけが後から流れてきます。
 *
 * 読めなかったときに**例外にしない**のは今までどおりです ── この部品は 404 ページを含む
 * 全ページで動くので、ここで投げるとビルドごと止まります
 * （環境変数の入れ忘れでデプロイが丸ごと失敗したことがある。2026-09-25）。
 */
export async function MenuBarSlot() {
  const user = await getMenuBarUser();
  return <AppMenuBar isAuthenticated={user !== null} />;
}

/** メニューバーの出し分け用に、ログイン状態だけを見る。失敗しても画面は描く（未ログイン扱い） */
export async function getMenuBarUser() {
  try {
    return await getAuthUserFromClaims(await createClient());
  } catch (error) {
    /*
     * #895（2026-10-09）: Next.js の**内部的な合図**は、ここで握りつぶさずに投げ直す。
     *
     * 【初心者向け】`cookies()` を使っている画面を Next.js が「静的に作れるか」試すとき、
     * `DYNAMIC_SERVER_USAGE` という合図を**例外の形で**投げてくる。これはエラーではなく
     * 「このページは毎回サーバーで描くものだ」と伝えるための仕組み。
     *
     * それをこの `catch` が拾って `console.error` に流していたため、**ビルドのたびに
     * ページ数ぶんの赤字**がログに並んでいた。成功しているのに失敗に見えるので、
     * 本物の失敗がその中に埋もれる。
     *
     * `unstable_rethrow` は Next.js が用意している公式の口で、`notFound()`・`redirect()`・
     * `permanentRedirect()` と、`cookies`/`headers`/`searchParams` の合図をまとめて投げ直す。
     * （同梱ドキュメント: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md）
     */
    unstable_rethrow(error);
    console.error("[layout] ログイン状態を確認できませんでした:", error);
    return null;
  }
}
