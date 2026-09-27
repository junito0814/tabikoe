import { AdminShell } from "@/components/admin/AdminShell";
import { countAdminBadges } from "@/lib/admin/badge-counts";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 件数は毎リクエスト数える（ビルド時に固定しない）
export const dynamic = "force-dynamic";

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
    console.error("[admin/layout] メニューの件数を取得できませんでした:", error);
    return { adminName: "管理者", badges: { reports: 0, hidden: 0 } };
  }
}
