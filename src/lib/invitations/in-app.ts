import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { computeInvitationExpiry, generateInvitationToken } from "@/lib/albums/invitations";
import { acceptItineraryInvitation } from "@/lib/itineraries/invitations";
import { createNotification, createNotificationsForMany } from "@/lib/notifications/create-notification";
import { toUserSummary, type UserSummary } from "@/lib/users/search-users";

/**
 * feedback-0919 Task6（v3.2）: アプリ内招待（しおり・アルバム共通）
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
 *       要件定義書 v3.2 3.6.3「アプリ内招待」・3.11.7・3.9.1
 *
 * 【初心者向け】招待リンクと同じテーブル（album_invitations／itinerary_invitations）を使い、
 * `invitee_user_id`（宛先）と `status` を足しただけ。受諾はリンク招待と同じ処理（アルバムは album_members への追加、
 * しおりは DB 関数 accept_itinerary_invitation）を使い回す。
 *   - 候補（listInviteCandidates）: 自分と同じアルバム・しおりに入ったことがある人。既存メンバー・ブロック関係・自分は除く。
 *     未回答の招待がある相手は pendingInvitationId 付きで返す（画面は「送信済み」にする）
 *   - 送信（sendInAppInvitation）: 行を作って宛先に通知（album_invited／itinerary_invited。related_id は招待 id）
 *   - 応答（respondToInvitation）: 宛先本人だけ。accept は参加処理＋参加通知、decline は status を declined にするだけ（オーナーに通知しない）
 */
export type InvitationKind = "album" | "itinerary";

const TABLE: Record<InvitationKind, "album_invitations" | "itinerary_invitations"> = { album: "album_invitations", itinerary: "itinerary_invitations" };
const TARGET_COLUMN: Record<InvitationKind, "trip_id" | "itinerary_id"> = { album: "trip_id", itinerary: "itinerary_id" };
const MEMBER_TABLE: Record<InvitationKind, "album_members" | "itinerary_members"> = { album: "album_members", itinerary: "itinerary_members" };

export interface InviteCandidate extends UserSummary {
  /** 未回答のアプリ内招待があればその id（画面は「送信済み」） */
  pendingInvitationId: string | null;
}

/** 自分と一緒のアルバム・しおりに入ったことがあるユーザー（純粋な集合演算はここ） */
export async function listInviteCandidates(admin: SupabaseClient, viewerId: string, kind: InvitationKind, targetId: string): Promise<InviteCandidate[]> {
  const [myTrips, myItineraries, blockedIds, members, pending] = await Promise.all([
    admin.from("album_members").select("trip_id").eq("user_id", viewerId),
    admin.from("itinerary_members").select("itinerary_id").eq("user_id", viewerId),
    getBlockedUserIds(admin, viewerId),
    admin.from(MEMBER_TABLE[kind]).select("user_id").eq(TARGET_COLUMN[kind], targetId),
    admin.from(TABLE[kind]).select("id, invitee_user_id").eq(TARGET_COLUMN[kind], targetId).eq("status", "pending").not("invitee_user_id", "is", null),
  ]);
  const tripIds = ((myTrips.data ?? []) as { trip_id: string }[]).map((row) => row.trip_id);
  const itineraryIds = ((myItineraries.data ?? []) as { itinerary_id: string }[]).map((row) => row.itinerary_id);
  const [tripMates, itineraryMates] = await Promise.all([
    tripIds.length ? admin.from("album_members").select("user_id").in("trip_id", tripIds) : Promise.resolve({ data: [] as { user_id: string }[] }),
    itineraryIds.length ? admin.from("itinerary_members").select("user_id").in("itinerary_id", itineraryIds) : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const exclude = new Set<string>([viewerId, ...blockedIds, ...((members.data ?? []) as { user_id: string }[]).map((row) => row.user_id)]);
  const mateIds = Array.from(
    new Set([...((tripMates.data ?? []) as { user_id: string }[]), ...((itineraryMates.data ?? []) as { user_id: string }[])].map((row) => row.user_id))
  ).filter((id) => !exclude.has(id));
  if (mateIds.length === 0) return [];

  const { data: users, error } = await admin.from("users").select("id, display_name, avatar_url, is_deleted").in("id", mateIds).eq("is_deleted", false).order("display_name");
  if (error) throw error;
  const pendingByUser = new Map(((pending.data ?? []) as { id: string; invitee_user_id: string }[]).map((row) => [row.invitee_user_id, row.id]));
  return ((users ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((row) => ({
    ...toUserSummary(row),
    pendingInvitationId: pendingByUser.get(row.id) ?? null,
  }));
}

export type SendResult = { ok: true; invitationId: string } | { ok: false; error: "already_member" | "already_pending" | "blocked" | "invitee_not_found" | "insert_failed" };

/** アプリ内招待を送る（行を作って宛先に通知）。role はアルバムだけ */
export async function sendInAppInvitation(
  admin: SupabaseClient,
  input: {
    kind: InvitationKind;
    targetId: string;
    inviterId: string;
    inviteeId: string;
    role?: "editor" | "viewer";
    /**
     * #869: しおりの招待のとき、同じ旅行のアルバムにも招待するか（既定は true）。
     * アルバムに入るとその人の非公開投稿が見えるようになるので、**送る側が決める**（要件 3.11.7）。
     */
    inviteToAlbum?: boolean;
  },
  now: Date = new Date()
): Promise<SendResult> {
  const { kind, targetId, inviterId, inviteeId } = input;
  const [invitee, member, blockedIds] = await Promise.all([
    admin.from("users").select("id, is_deleted").eq("id", inviteeId).maybeSingle(),
    admin.from(MEMBER_TABLE[kind]).select("user_id").eq(TARGET_COLUMN[kind], targetId).eq("user_id", inviteeId).maybeSingle(),
    getBlockedUserIds(admin, inviterId),
  ]);
  if (!invitee.data || invitee.data.is_deleted || inviteeId === inviterId) return { ok: false, error: "invitee_not_found" };
  if (member.data) return { ok: false, error: "already_member" };
  if (blockedIds.includes(inviteeId)) return { ok: false, error: "blocked" };

  const row: Record<string, unknown> = {
    [TARGET_COLUMN[kind]]: targetId,
    token: generateInvitationToken(),
    created_by: inviterId,
    invitee_user_id: inviteeId,
    status: "pending",
    expires_at: computeInvitationExpiry(now).toISOString(),
  };
  if (kind === "album") row.role = input.role ?? "viewer";
  // #869: しおりだけが持つ。受諾のときに読む
  if (kind === "itinerary") row.invite_to_album = input.inviteToAlbum ?? true;
  const { data, error } = await admin.from(TABLE[kind]).insert(row).select("id").single();
  if (error || !data) {
    // 部分ユニーク索引（未回答は 1 件）に弾かれた
    if (error?.code === "23505") return { ok: false, error: "already_pending" };
    return { ok: false, error: "insert_failed" };
  }
  await createNotification(admin, { recipientId: inviteeId, actorId: inviterId, type: kind === "album" ? "album_invited" : "itinerary_invited", relatedId: data.id });
  return { ok: true, invitationId: data.id };
}

export interface InAppInvitationRow {
  id: string;
  token: string;
  target_id: string;
  invitee_user_id: string | null;
  status: string;
  expires_at: string;
  /** #869: しおりの招待だけが持つ。受諾時にアルバムにも加えるか（列が無い環境では undefined） */
  invite_to_album?: boolean | null;
  revoked_at: string | null;
  role?: string;
}

export async function findInAppInvitation(admin: SupabaseClient, kind: InvitationKind, invitationId: string): Promise<InAppInvitationRow | null> {
  // #869: しおりは「アルバムにも招待するか」も読む（列が無い環境では undefined のまま）
  const columns = `id, token, ${TARGET_COLUMN[kind]}, invitee_user_id, status, expires_at, revoked_at${kind === "album" ? ", role" : ", invite_to_album"}`;
  const { data, error } = await admin.from(TABLE[kind]).select(columns).eq("id", invitationId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    id: row.id as string,
    token: row.token as string,
    target_id: row[TARGET_COLUMN[kind]] as string,
    invitee_user_id: (row.invitee_user_id as string | null) ?? null,
    status: row.status as string,
    expires_at: row.expires_at as string,
    revoked_at: (row.revoked_at as string | null) ?? null,
    invite_to_album: row.invite_to_album as boolean | null | undefined,
    role: row.role as string | undefined,
  };
}

export type RespondResult =
  | { ok: true; action: "accept" | "decline"; targetId: string; alreadyMember: boolean }
  | { ok: false; error: "not_found" | "forbidden" | "not_pending" | "expired" | "accept_failed" };

/** 宛先本人が「参加する」「辞退」する */
export async function respondToInvitation(
  admin: SupabaseClient,
  input: { kind: InvitationKind; invitationId: string; userId: string; action: "accept" | "decline" },
  now: Date = new Date()
): Promise<RespondResult> {
  const { kind, invitationId, userId, action } = input;
  const invitation = await findInAppInvitation(admin, kind, invitationId);
  if (!invitation) return { ok: false, error: "not_found" };
  if (invitation.invitee_user_id !== userId) return { ok: false, error: "forbidden" };
  if (invitation.status !== "pending" || invitation.revoked_at) return { ok: false, error: "not_pending" };
  if (new Date(invitation.expires_at).getTime() < now.getTime()) return { ok: false, error: "expired" };

  if (action === "decline") {
    await admin.from(TABLE[kind]).update({ status: "declined", responded_at: now.toISOString() }).eq("id", invitationId);
    return { ok: true, action, targetId: invitation.target_id, alreadyMember: false };
  }

  const memberTable = MEMBER_TABLE[kind];
  const { data: existing } = await admin.from(memberTable).select("user_id").eq(TARGET_COLUMN[kind], invitation.target_id).eq("user_id", userId).maybeSingle();
  if (!existing) {
    if (kind === "album") {
      const { error } = await admin.from("album_members").insert({ trip_id: invitation.target_id, user_id: userId, role: invitation.role ?? "viewer" });
      if (error && error.code !== "23505") return { ok: false, error: "accept_failed" };
    } else {
      // しおりは DB 関数（期限・無効化の検証と itinerary_members への追加）を token で呼ぶ
      const accepted = await acceptItineraryInvitation(admin, invitation.token, userId).catch(() => null);
      if (!accepted) return { ok: false, error: "accept_failed" };
    }
  }
  await admin.from(TABLE[kind]).update({ status: "accepted", responded_at: now.toISOString() }).eq("id", invitationId);

  /*
   * #869（2026-10-07）: しおりの招待で「アルバムにも招待する」が選ばれていたら、
   * **同じ旅行のアルバムにも**加える（編集者。自分の投稿を足せる。他人の投稿は触れない）。
   *
   * 【初心者向け】しおりとアルバムは同じ旅行に紐づいているのに、しおりに招待しても
   * アルバムには入らず、招待し直す二度手間になっていました（実機確認での指摘）。
   * **既にアルバムのメンバーなら何もしません**（権限を上げも下げもしない）。
   */
  if (kind === "itinerary" && invitation.invite_to_album !== false) {
    const { data: itinerary } = await admin.from("itineraries").select("trip_id").eq("id", invitation.target_id).maybeSingle();
    const tripId = (itinerary as { trip_id: string } | null)?.trip_id ?? null;
    if (tripId) {
      const { data: albumMember } = await admin.from("album_members").select("user_id").eq("trip_id", tripId).eq("user_id", userId).maybeSingle();
      if (!albumMember) {
        const { error: joinError } = await admin.from("album_members").insert({ trip_id: tripId, user_id: userId, role: "editor" });
        // 23505＝同時に入った（競り合い）。それ以外でも、しおりには入れているので失敗にはしない
        if (!joinError || joinError.code === "23505") {
          const { data: albumMembers } = await admin.from("album_members").select("user_id").eq("trip_id", tripId);
          await createNotificationsForMany(admin, {
            recipientIds: ((albumMembers ?? []) as { user_id: string }[]).map((row) => row.user_id),
            actorId: null,
            type: "album_join",
            relatedId: tripId,
          });
        }
      }
    }
  }

  // 参加通知（リンク招待の受諾と同じ）: 本人・オーナー・既存メンバー
  const { data: members } = await admin.from(memberTable).select("user_id").eq(TARGET_COLUMN[kind], invitation.target_id);
  const recipientIds = ((members ?? []) as { user_id: string }[]).map((row) => row.user_id);
  await createNotificationsForMany(admin, { recipientIds, actorId: null, type: kind === "album" ? "album_join" : "itinerary_joined", relatedId: invitation.target_id });
  return { ok: true, action, targetId: invitation.target_id, alreadyMember: Boolean(existing) };
}
