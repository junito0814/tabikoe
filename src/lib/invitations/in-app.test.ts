import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/blocks/get-blocked-user-ids", () => ({ getBlockedUserIds: async () => ["blocked"] }));
vi.mock("@/lib/notifications/create-notification", () => ({ createNotification: vi.fn(async () => "created"), createNotificationsForMany: vi.fn(async () => ({ created: 1, skipped: 0, failed: 0 })) }));
vi.mock("@/lib/itineraries/invitations", () => ({ acceptItineraryInvitation: vi.fn(async () => "it-1") }));

import { createNotification, createNotificationsForMany } from "@/lib/notifications/create-notification";
import { listInviteCandidates, respondToInvitation, sendInAppInvitation } from "./in-app";

/**
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md 単体テスト
 * - 候補に既存メンバー・ブロック関係・自分が含まれないこと
 * - 同じ相手への未回答の招待が 2 件目で拒否されること
 * - 通知の「参加する」で accept が呼ばれメンバーに加わること。「辞退」で status が declined になりオーナーに通知が行かないこと
 *
 * 【初心者向け】テーブルごとに「返す行」を決めた偽の Supabase。メソッドチェーンは何を呼んでも自分を返し、
 * await したときにそのテーブルの行を返す（maybeSingle は先頭 1 件）。insert／update は記録だけする。
 */
function fakeAdmin(tables: Record<string, unknown[]>, options: { insertError?: { code: string } } = {}) {
  const inserted: { table: string; row: unknown }[] = [];
  const updated: { table: string; patch: unknown }[] = [];
  const client = {
    from: (table: string) => {
      const rows = tables[table] ?? [];
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "not", "order", "neq", "ilike", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
      q.single = async () => (options.insertError ? { data: null, error: options.insertError } : { data: { id: "inv-new" }, error: null });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
      q.insert = (row: unknown) => {
        inserted.push({ table, row });
        return q;
      };
      q.update = (patch: unknown) => {
        updated.push({ table, patch });
        return q;
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, inserted, updated };
}

describe("listInviteCandidates", () => {
  it("一緒だった人から、自分・既存メンバー・ブロック関係を除き、未回答の招待がある人には pendingInvitationId を付ける", async () => {
    const { client } = fakeAdmin({
      album_members: [{ user_id: "me" }, { user_id: "ai" }, { user_id: "member" }, { user_id: "blocked" }],
      itinerary_members: [{ user_id: "kenta" }],
      itinerary_invitations: [{ id: "inv-1", invitee_user_id: "kenta" }],
      users: [
        { id: "ai", display_name: "あい", avatar_url: null },
        { id: "kenta", display_name: "けんた", avatar_url: null },
      ],
    });
    // MEMBER_TABLE（itinerary_members）の既存メンバーには member を入れたいが、同じ偽テーブルを共有するので users で絞る
    const candidates = await listInviteCandidates(client, "me", "itinerary", "it-1");
    expect(candidates.map((c) => c.id)).toEqual(["ai", "kenta"]);
    expect(candidates.find((c) => c.id === "kenta")?.pendingInvitationId).toBe("inv-1");
    expect(candidates.find((c) => c.id === "ai")?.pendingInvitationId).toBeNull();
  });
});

describe("sendInAppInvitation", () => {
  it("行を作って宛先に通知する（しおり）", async () => {
    const { client, inserted } = fakeAdmin({ users: [{ id: "ai", is_deleted: false }], itinerary_members: [] });
    const result = await sendInAppInvitation(client, { kind: "itinerary", targetId: "it-1", inviterId: "me", inviteeId: "ai" });
    expect(result).toEqual({ ok: true, invitationId: "inv-new" });
    expect(inserted[0]).toMatchObject({ table: "itinerary_invitations", row: expect.objectContaining({ itinerary_id: "it-1", invitee_user_id: "ai", status: "pending", created_by: "me" }) });
    expect(createNotification).toHaveBeenCalledWith(client, expect.objectContaining({ recipientId: "ai", type: "itinerary_invited", relatedId: "inv-new" }));
  });

  it("既にメンバー・ブロック関係・未回答が 2 件目 は拒否", async () => {
    const member = fakeAdmin({ users: [{ id: "ai", is_deleted: false }], album_members: [{ user_id: "ai" }] });
    expect(await sendInAppInvitation(member.client, { kind: "album", targetId: "t1", inviterId: "me", inviteeId: "ai", role: "viewer" })).toEqual({ ok: false, error: "already_member" });
    const blocked = fakeAdmin({ users: [{ id: "blocked", is_deleted: false }], album_members: [] });
    expect(await sendInAppInvitation(blocked.client, { kind: "album", targetId: "t1", inviterId: "me", inviteeId: "blocked", role: "viewer" })).toEqual({ ok: false, error: "blocked" });
    const dup = fakeAdmin({ users: [{ id: "ai", is_deleted: false }], album_members: [] }, { insertError: { code: "23505" } });
    expect(await sendInAppInvitation(dup.client, { kind: "album", targetId: "t1", inviterId: "me", inviteeId: "ai", role: "viewer" })).toEqual({ ok: false, error: "already_pending" });
  });
});

describe("respondToInvitation", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  it("宛先本人の「参加する」でメンバーに加わり、accepted になって参加通知が出る（アルバム）", async () => {
    const { client, inserted, updated } = fakeAdmin({
      album_invitations: [{ id: "inv-1", token: "tok", trip_id: "t1", invitee_user_id: "ai", status: "pending", expires_at: future, revoked_at: null, role: "editor" }],
      album_members: [],
    });
    const result = await respondToInvitation(client, { kind: "album", invitationId: "inv-1", userId: "ai", action: "accept" });
    expect(result).toMatchObject({ ok: true, action: "accept", targetId: "t1" });
    expect(inserted[0]).toMatchObject({ table: "album_members", row: { trip_id: "t1", user_id: "ai", role: "editor" } });
    expect(updated[0]).toMatchObject({ table: "album_invitations", patch: expect.objectContaining({ status: "accepted" }) });
    expect(createNotificationsForMany).toHaveBeenCalledWith(client, expect.objectContaining({ type: "album_join", relatedId: "t1" }));
  });

  it("「辞退」は declined にするだけで通知は出さない。本人以外は forbidden、回答済みは not_pending", async () => {
    vi.mocked(createNotificationsForMany).mockClear();
    const { client, updated } = fakeAdmin({
      itinerary_invitations: [{ id: "inv-2", token: "tok", itinerary_id: "it-1", invitee_user_id: "ai", status: "pending", expires_at: future, revoked_at: null }],
    });
    expect(await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-2", userId: "ai", action: "decline" })).toMatchObject({ ok: true, action: "decline" });
    expect(updated[0]).toMatchObject({ patch: expect.objectContaining({ status: "declined" }) });
    expect(createNotificationsForMany).not.toHaveBeenCalled();
    expect(await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-2", userId: "other", action: "accept" })).toEqual({ ok: false, error: "forbidden" });
    const done = fakeAdmin({ itinerary_invitations: [{ id: "inv-3", token: "tok", itinerary_id: "it-1", invitee_user_id: "ai", status: "accepted", expires_at: future, revoked_at: null }] });
    expect(await respondToInvitation(done.client, { kind: "itinerary", invitationId: "inv-3", userId: "ai", action: "accept" })).toEqual({ ok: false, error: "not_pending" });
  });
});

/*
 * #869（2026-10-07）: しおりの招待で「アルバムにも招待する」。
 *
 * 【初心者向け】しおりとアルバムは同じ旅行に紐づくのに、しおりに招待してもアルバムには
 * 入らず、招待し直す二度手間になっていた（実機確認での指摘）。
 * ただしアルバムに入ると**その人には非公開の投稿も見える**ので、送る側が決める形にしてある。
 */
describe("しおりの招待でアルバムにも入れる（#869）", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const invitation = (inviteToAlbum: boolean | undefined) => ({
    id: "inv-9",
    token: "tok",
    itinerary_id: "it-1",
    invitee_user_id: "ai",
    status: "pending",
    expires_at: future,
    revoked_at: null,
    ...(inviteToAlbum === undefined ? {} : { invite_to_album: inviteToAlbum }),
  });

  it("送るときの選択を招待の行に覚える（既定は true）", async () => {
    const on = fakeAdmin({ users: [{ id: "ai", is_deleted: false }], itinerary_members: [] });
    await sendInAppInvitation(on.client, { kind: "itinerary", targetId: "it-1", inviterId: "me", inviteeId: "ai" });
    expect(on.inserted[0].row).toMatchObject({ invite_to_album: true });

    const off = fakeAdmin({ users: [{ id: "ai", is_deleted: false }], itinerary_members: [] });
    await sendInAppInvitation(off.client, { kind: "itinerary", targetId: "it-1", inviterId: "me", inviteeId: "ai", inviteToAlbum: false });
    expect(off.inserted[0].row).toMatchObject({ invite_to_album: false });
  });

  it("「参加する」で、しおりと同じ旅行のアルバムにも編集者として入る", async () => {
    const { client, inserted } = fakeAdmin({
      itinerary_invitations: [invitation(true)],
      itineraries: [{ trip_id: "trip-1" }],
      itinerary_members: [],
      album_members: [],
    });
    const result = await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-9", userId: "ai", action: "accept" });
    expect(result).toMatchObject({ ok: true, action: "accept" });
    expect(inserted).toContainEqual({ table: "album_members", row: { trip_id: "trip-1", user_id: "ai", role: "editor" } });
  });

  it("「アルバムにも招待する」を外して送った招待では、アルバムに入れない", async () => {
    const { client, inserted } = fakeAdmin({
      itinerary_invitations: [invitation(false)],
      itineraries: [{ trip_id: "trip-1" }],
      itinerary_members: [],
      album_members: [],
    });
    await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-9", userId: "ai", action: "accept" });
    expect(inserted.some((row) => row.table === "album_members")).toBe(false);
  });

  it("既にアルバムのメンバーなら何もしない（権限を上げも下げもしない）", async () => {
    const { client, inserted } = fakeAdmin({
      itinerary_invitations: [invitation(true)],
      itineraries: [{ trip_id: "trip-1" }],
      itinerary_members: [],
      album_members: [{ user_id: "ai" }],
    });
    await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-9", userId: "ai", action: "accept" });
    expect(inserted.some((row) => row.table === "album_members")).toBe(false);
  });

  it("列がまだ無い環境（undefined）でも、既定どおりアルバムに入れる", async () => {
    const { client, inserted } = fakeAdmin({
      itinerary_invitations: [invitation(undefined)],
      itineraries: [{ trip_id: "trip-1" }],
      itinerary_members: [],
      album_members: [],
    });
    await respondToInvitation(client, { kind: "itinerary", invitationId: "inv-9", userId: "ai", action: "accept" });
    expect(inserted.some((row) => row.table === "album_members")).toBe(true);
  });
});
