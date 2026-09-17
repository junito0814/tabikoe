import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * itinerary-basics Task1 / itinerary-sharing Task3: しおりのメンバー判定と権限表
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md
 *       docs/tasks/itinerary/itinerary-sharing/03-permissions-and-ownership.md
 *       要件定義書 v3.0 3.11.7
 *
 * 【初心者向け】アルバム（albums/membership.ts）と同じ形。役割は owner / member の 2 つ。
 *   - member : スポットの追加・削除、Day・時刻・メモ・チェック
 *   - owner  : さらに 招待・メンバー削除・期間・タイトル・しおりの削除
 *   - 非メンバー: 存在自体を知らせない（404）
 * 権限の表（ITINERARY_PERMISSIONS）を 1 か所に置き、各 Route Handler は `can(role, "invite")` のように問い合わせる。
 * RLS でも同じことを守っているが、Route Handler は service_role で読むので、ここでの判定が実質の防御になる。
 */
export const ITINERARY_ROLES = ["owner", "member"] as const;
export type ItineraryRole = (typeof ITINERARY_ROLES)[number];

export const ITINERARY_ROLE_LABELS: Record<ItineraryRole, string> = {
  owner: "オーナー",
  member: "メンバー",
};

export type ItineraryAction =
  | "view"
  | "add_spot"
  | "remove_spot"
  | "move_day"
  | "set_time"
  | "edit_memo"
  | "reorder"
  | "check"
  | "invite"
  | "manage_members"
  | "change_period"
  | "rename"
  | "delete";

/** 役割ごとに許される操作（単体テストの対象） */
export const ITINERARY_PERMISSIONS: Record<ItineraryAction, readonly ItineraryRole[]> = {
  view: ["owner", "member"],
  add_spot: ["owner", "member"],
  remove_spot: ["owner", "member"],
  move_day: ["owner", "member"],
  set_time: ["owner", "member"],
  edit_memo: ["owner", "member"],
  reorder: ["owner", "member"],
  check: ["owner", "member"],
  invite: ["owner"],
  manage_members: ["owner"],
  change_period: ["owner"],
  rename: ["owner"],
  delete: ["owner"],
};

export function isItineraryRole(value: unknown): value is ItineraryRole {
  return (ITINERARY_ROLES as readonly string[]).includes(String(value));
}

export function can(role: ItineraryRole | null, action: ItineraryAction): boolean {
  return role !== null && ITINERARY_PERMISSIONS[action].includes(role);
}

/** 純粋な判定部分（単体テストの対象）。行が無ければ非メンバー */
export function resolveItineraryRole(membership: { role: string } | null): ItineraryRole | null {
  return membership && isItineraryRole(membership.role) ? membership.role : null;
}

export async function getItineraryRole(admin: SupabaseClient, itineraryId: string, userId: string): Promise<ItineraryRole | null> {
  const { data, error } = await admin
    .from("itinerary_members")
    .select("role")
    .eq("itinerary_id", itineraryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return resolveItineraryRole(data);
}
