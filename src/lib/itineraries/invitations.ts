import type { SupabaseClient } from "@supabase/supabase-js";
import { computeInvitationExpiry, evaluateInvitation, generateInvitationToken, type InvitationValidity } from "@/lib/albums/invitations";

/**
 * itinerary-sharing Task1: しおりの招待リンク
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *       要件定義書 v3.0 3.11.7（アルバムと同じ方式。7 日で失効。役割は member 固定）
 *
 * 【初心者向け】トークンの生成・有効期限・期限判定はアルバム（albums/invitations.ts）のものをそのまま使う。
 * 受諾は DB の security definer 関数 `accept_itinerary_invitation` に任せる（期限・無効化の検証と
 * itinerary_members への追加を 1 か所で行う）。
 */
export { computeInvitationExpiry, evaluateInvitation, generateInvitationToken };
export type { InvitationValidity };

export function buildItineraryInvitationPath(token: string): string {
  return `/itinerary-invitations/${token}`;
}

export interface ItineraryInvitationRow {
  id: string;
  itinerary_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export async function issueItineraryInvitation(admin: SupabaseClient, itineraryId: string, createdBy: string, now: Date = new Date()) {
  const token = generateInvitationToken();
  const { data, error } = await admin
    .from("itinerary_invitations")
    .insert({ itinerary_id: itineraryId, token, created_by: createdBy, expires_at: computeInvitationExpiry(now).toISOString() })
    .select("id, itinerary_id, token, created_by, expires_at, revoked_at, created_at")
    .single();
  if (error || !data) throw error ?? new Error("insert_failed");
  return data as ItineraryInvitationRow;
}

/** 受諾。無効・期限切れ・存在しない場合は null（区別は呼び出し側で evaluate する） */
export async function acceptItineraryInvitation(admin: SupabaseClient, token: string, userId: string): Promise<string | null> {
  const { data, error } = await admin.rpc("accept_itinerary_invitation", { p_token: token, p_user_id: userId });
  if (error) throw error;
  return (data as string | null) ?? null;
}
