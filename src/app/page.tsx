import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { SearchTopScreen } from "@/components/search/SearchTopScreen";
import AuthScreen from "@/components/auth/AuthScreen";

/**
 * SC-00 検索トップ（ホーム）
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md
 *       docs/user-stories/account/signup-login.md（2026-09-25: 未ログイン表示を SC-01 と同じ内容に）
 *       要件定義書 3.4.1・3.2.1・4.1
 *
 * 【初心者向け】`async function` の Server Component。Cookie からログイン状態を確認し、
 *   - ログイン済み: 検索トップ（ハブ。SearchTopScreen）を出す
 *   - 未ログイン: ログイン画面（SC-01）と同じ内容をその場に出す（2026-09-25。「はじめる」→ ログインの 2 段階を廃止）
 *     背景の空のグラデーションはこの画面にだけ付ける（`/login` は白地）
 * `?itinerary=&day=` が付いていれば、しおりの追加モード（add-spots Task2）として行き先の入力を促す。
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUserFromClaims(await createClient());

  if (!user) {
    // AuthScreen は useSearchParams を使うので Suspense で包む（/login と同じ）
    return (
      <Suspense fallback={null}>
        <AuthScreen sky />
      </Suspense>
    );
  }

  const params = await searchParams;
  const itinerary = typeof params.itinerary === "string" ? params.itinerary : null;
  const day = typeof params.day === "string" ? params.day : null;
  return <SearchTopScreen addMode={itinerary ? { itinerary, day } : null} />;
}
