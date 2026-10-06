import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { isBlockedEitherWay } from "@/lib/blocks/get-blocked-user-ids";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { userTitle } from "@/lib/metadata/page-title";
import { resolveListBack } from "@/lib/search/list-state";
import { getPublicPostsByUser, getPublicProfileStats } from "@/lib/users/public-profile";
import { PublicProfileScreen } from "@/components/users/PublicProfileScreen";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

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
  const selfHref = `/users/${id}`;
  // #767: 来た画面（投稿詳細から来たら「‹ 投稿」）。無ければホーム
  const back = resolveListBack(query.back ?? null);
  const [stats, posts] = await Promise.all([
    getPublicProfileStats(admin, id),
    getPublicPostsByUser(admin, id, viewer.id, 0).catch(() => ({ posts: [], nextOffset: null })),
  ]);

  return (
    <PublicProfileScreen
      userId={id}
      displayName={displayName}
      avatarUrl={profile.avatar_url ?? DEFAULT_AVATAR_URL}
      stats={stats}
      posts={posts.posts}
      isSelf={isSelf}
      back={back}
      selfHref={selfHref}
    />
  );
}
