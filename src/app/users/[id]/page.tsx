import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";

/**
 * F-AC-05 Task5: 退会後のプロフィール非表示処理
 * 出典: docs/tasks/account/account-deletion/05-profile-visibility-after-deletion.md
 *
 * プロフィール画面本体（F-RC-01 マイページ）はまだ実装されていない。
 * 本ページはis_deletedユーザーへのアクセスを404にするという受入条件を
 * 満たすための最小限の実装であり、my-page実装時にそちらへ統合する。
 *
 * usersテーブルのRLSは自分の行しかSELECTできないため（F-AC-01の方針）、
 * 他人のプロフィールを閲覧できるようにAdminクライアントで参照している。
 * 閲覧範囲の正式なポリシー設計はF-RC-01側で行う。
 */
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("display_name, avatar_url, is_deleted")
    .eq("id", id)
    .single();

  if (!profile || profile.is_deleted) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBF6F0] px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.avatar_url ?? DEFAULT_AVATAR_URL}
        alt=""
        className="h-24 w-24 rounded-full object-cover"
      />
      <p className="text-[15px] font-semibold text-[#3D3A35]">
        {profile.display_name ?? "ユーザー"}
      </p>
    </div>
  );
}
