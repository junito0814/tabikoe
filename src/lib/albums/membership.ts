import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F-RC-02 / F-RC-03: アルバム（旅行）のメンバー判定
 * 出典: docs/tasks/records/album/01-album-detail-handler.md
 *       docs/tasks/records/album-collaboration/05-member-role-management-handler.md
 *       要件定義書3.6.3（権限の種類）
 *
 * album_members の行が正。trips.user_id と一致する場合も、行が欠けていればオーナーとして扱う
 * （20260914000002 のトリガー・補完で通常は行が存在する）。
 */
export const ALBUM_ROLES = ["owner", "editor", "viewer"] as const;
export type AlbumRole = (typeof ALBUM_ROLES)[number];

/** 招待で付与できる権限（オーナーは付与不可） */
export const INVITABLE_ROLES = ["editor", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ALBUM_ROLE_LABELS: Record<AlbumRole, string> = {
  owner: "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
};

export function isAlbumRole(value: unknown): value is AlbumRole {
  return (ALBUM_ROLES as readonly string[]).includes(String(value));
}

export function isInvitableRole(value: unknown): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(String(value));
}

/** 投稿を追加できる権限（3.6.3: オーナー・編集者） */
export function canAddPosts(role: AlbumRole | null): boolean {
  return role === "owner" || role === "editor";
}

/** 純粋な判定部分（単体テストの対象） */
export function resolveAlbumRole(
  membership: { role: string } | null,
  trip: { user_id: string } | null,
  userId: string
): AlbumRole | null {
  if (membership && isAlbumRole(membership.role)) return membership.role;
  if (trip && trip.user_id === userId) return "owner";
  return null;
}

export async function getAlbumRole(
  admin: SupabaseClient,
  tripId: string,
  userId: string
): Promise<AlbumRole | null> {
  const [membership, trip] = await Promise.all([
    admin.from("album_members").select("role").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
    admin.from("trips").select("user_id").eq("id", tripId).maybeSingle(),
  ]);
  if (membership.error) throw membership.error;
  if (trip.error) throw trip.error;
  return resolveAlbumRole(membership.data, trip.data, userId);
}
