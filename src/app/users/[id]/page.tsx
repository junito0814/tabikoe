import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { isBlockedEitherWay } from "@/lib/blocks/get-blocked-user-ids";
import { BlockUserButton } from "@/components/blocks/BlockUserButton";
import { ReportLink } from "@/components/reports/ReportLink";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { userTitle } from "@/lib/metadata/page-title";

/**
 * F-AC-05 Task5: 退会後のプロフィール非表示処理
 * F-SF-02 Task3: ブロック導線、およびブロック関係にあるプロフィールの非表示（3.8.2）
 * 出典: docs/tasks/account/account-deletion/05-profile-visibility-after-deletion.md
 *       docs/tasks/safety/blocking/03-block-management-ui.md
 *
 * プロフィール画面本体（F-RC-01 マイページ）はまだ実装されていない。
 * 本ページはis_deletedユーザーへのアクセスを404にするという受入条件を
 * 満たすための最小限の実装であり、my-page実装時にそちらへ統合する。
 *
 * usersテーブルのRLSは自分の行しかSELECTできないため（F-AC-01の方針）、
 * 他人のプロフィールを閲覧できるようにAdminクライアントで参照している。
 * 閲覧範囲の正式なポリシー設計はF-RC-01側で行う。
 */
/** #785: タブ名は表示名。退会済み・見つからないときは出さない */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = await userTitle(id);
  return name ? { title: name } : {};
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 要件定義書3.5.4: 未ログイン状態でトップページ以外へ直接アクセスした場合は
  // ログイン画面へ誘導し、ログイン完了後に元の遷移先へ戻す
  const supabase = await createClient();
  const viewer = await requireUserOrRedirect(supabase, `/users/${id}`);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("display_name, avatar_url, is_deleted")
    .eq("id", id)
    .single();

  if (!profile || profile.is_deleted) {
    notFound();
  }

  const isSelf = viewer.id === id;

  // 3.8.2 相互非表示: どちらの方向のブロックでもプロフィールは見せない。
  // 存在自体を伏せるため、退会済みと同じ404にする
  if (!isSelf && (await isBlockedEitherWay(admin, viewer.id, id))) {
    notFound();
  }

  const displayName = profile.display_name ?? "ユーザー";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.avatar_url ?? DEFAULT_AVATAR_URL}
        alt={`${displayName}のアイコン画像`}
        className="h-24 w-24 rounded-full object-cover"
      />
      <p className="text-[15px] font-semibold text-ink">{displayName}</p>

      {!isSelf && (
        <div className="mt-4 flex w-full max-w-[360px] items-center justify-center gap-4">
          {/* F-SF-01 Task2: ユーザー通報の導線（SC-11へ） */}
          <ReportLink targetType="user" targetId={id} returnTo={`/users/${id}`} />
          <BlockUserButton targetUserId={id} targetDisplayName={displayName} />
        </div>
      )}
    </div>
  );
}
