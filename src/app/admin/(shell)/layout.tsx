import { unstable_rethrow } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { countAdminBadges } from "@/lib/admin/badge-counts";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/*
 * #901: 器を静的に作る対象から外す（instant = false）。
 *
 * 【初心者向け】管理画面は**パソコン前提・ログイン必須**で、開くのは運営だけです。
 * 器を先に配ってもうれしい人がいないうえ、ダッシュボードは `new Date()` など
 * **毎回変わるもの**を素で読んでいます。利用者向けの画面を先に進めるため、ここは外します。
 * 外しても動きは今までどおりです（毎回サーバーで描く）。
 */
export const instant = false;

/**
 * admin-shell-dashboard Task 1: /admin 配下の共通レイアウト
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       要件定義書 3.10.2
 *
 * 【初心者向け】layout.tsx は配下のページ全部の外枠。ここに 1 回書けば 7 画面すべてに同じメニューが付く。
 * 「管理者かどうか」の判定は src/proxy.ts が先に済ませている（違えば 404）ので、ここでは名前と件数を取るだけ。
 * 件数・名前が取れなくても枠は描く（0 件・「管理者」表示にする）。管理画面が丸ごと開けなくなるより、
 * 各ページ自身のエラー表示に任せる方が原因が分かりやすい。
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { adminName, badges } = await loadShellData();
  return (
    <AdminShell adminName={adminName} badges={badges}>
      {children}
    </AdminShell>
  );
}

async function loadShellData() {
  try {
    const user = await getAuthUserFromClaims(await createClient());
    const admin = createAdminClient();
    const [profile, badges] = await Promise.all([
      user ? admin.from("users").select("display_name").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      countAdminBadges(admin),
    ]);
    return { adminName: profile.data?.display_name ?? "管理者", badges };
  } catch (error) {
        // #895: Next.js の内部的な合図（redirect / notFound / cookies など）は投げ直す。
    // 握りつぶすと、ビルドログが赤字で埋まったり、転送が黙って効かなくなったりする
    unstable_rethrow(error);
    console.error("[admin/layout] メニューの件数を取得できませんでした:", error);
    return { adminName: "管理者", badges: { reports: 0, hidden: 0 } };
  }
}
