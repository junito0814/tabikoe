import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification, createNotificationsForMany } from "./create-notification";
import { NOTIFICATION_CATALOG, NOTIFICATION_TYPES, isNotificationType } from "./catalog";

/**
 * 出典: docs/tasks/notifications/notification-triggers/01-notification-helper.md 単体テスト
 *       docs/tasks/notifications/notification-triggers/02-notification-catalog.md 単体テスト
 *       要件定義書3.9.1（自分自身の操作を除く）
 */
function fakeAdmin(insertResult: { error: { message: string } | null } | Error = { error: null }) {
  const insert = vi.fn(async () => {
    if (insertResult instanceof Error) throw insertResult;
    return insertResult;
  });
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNotification（Task1）", () => {
  it("notifications に user_id・type・related_id・is_read=false を書き込む", async () => {
    const { client, from, insert } = fakeAdmin();

    const result = await createNotification(client, {
      recipientId: "author-1",
      actorId: "commenter-1",
      type: "comment",
      relatedId: "comment-9",
    });

    expect(result).toBe("created");
    expect(from).toHaveBeenCalledWith("notifications");
    expect(insert).toHaveBeenCalledWith({
      user_id: "author-1",
      type: "comment",
      related_id: "comment-9",
      is_read: false,
    });
  });

  it("行為者本人＝通知先の場合は INSERT しない（3.9.1「自分自身の操作を除く」）", async () => {
    const { client, insert } = fakeAdmin();

    const result = await createNotification(client, {
      recipientId: "user-1",
      actorId: "user-1",
      type: "like",
      relatedId: "post-1",
    });

    expect(result).toBe("skipped_self");
    expect(insert).not.toHaveBeenCalled();
  });

  it("行為者が無い通知（システム起因）はそのまま作成する", async () => {
    const { client, insert } = fakeAdmin();

    const result = await createNotification(client, {
      recipientId: "user-1",
      type: "report_resolved",
      relatedId: "report-1",
    });

    expect(result).toBe("created");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("INSERT がエラーを返しても例外を投げず failed を返す", async () => {
    const { client } = fakeAdmin({ error: { message: "permission denied" } });

    await expect(
      createNotification(client, { recipientId: "u", type: "comment", relatedId: "c" })
    ).resolves.toBe("failed");
    expect(console.error).toHaveBeenCalled();
  });

  it("INSERT 自体が throw しても例外を投げない", async () => {
    const { client } = fakeAdmin(new Error("network"));

    await expect(
      createNotification(client, { recipientId: "u", type: "comment", relatedId: "c" })
    ).resolves.toBe("failed");
  });
});

describe("createNotificationsForMany（複数通知先）", () => {
  it("受信者ごとに1件ずつ作成し、行為者本人は除外する", async () => {
    const { client, insert } = fakeAdmin();

    const summary = await createNotificationsForMany(client, {
      recipientIds: ["owner", "member-a", "joiner", "member-b"],
      actorId: "joiner",
      type: "album_join",
      relatedId: "trip-1",
    });

    expect(summary).toEqual({ created: 3, skipped: 1, failed: 0 });
    expect(insert).toHaveBeenCalledTimes(3);
    const recipients = insert.mock.calls.map((call) => (call as unknown[])[0] as { user_id: string });
    expect(recipients.map((row) => row.user_id)).toEqual(["owner", "member-a", "member-b"]);
  });

  it("重複した受信者は1件に畳む", async () => {
    const { client, insert } = fakeAdmin();

    const summary = await createNotificationsForMany(client, {
      recipientIds: ["owner", "owner", "member-a"],
      type: "album_join",
      relatedId: "trip-1",
    });

    expect(summary.created).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("空の受信者リストでは何もしない", async () => {
    const { client, insert } = fakeAdmin();

    const summary = await createNotificationsForMany(client, {
      recipientIds: [],
      type: "role_change",
      relatedId: "trip-1",
    });

    expect(summary).toEqual({ created: 0, skipped: 0, failed: 0 });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("通知種別カタログ（Task2）", () => {
  it("3.9.1の個人向け通知7種類＋v3.0 のしおり 2 種類＋v3.2 の返信・招待 3 種類＋Phase 17 の管理者向け 3 種類をすべて持つ", () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual(
      [
        "album_join", "comment", "like", "member_removed", "new_owner", "report_resolved", "role_change",
        "itinerary_joined", "itinerary_member_removed", "comment_replied", "album_invited", "itinerary_invited",
        "admin_report", "admin_auto_hidden", "admin_suspended",
      ].sort()
    );
  });

  it("カタログの type 値と共通関数が受け付ける値が一致する", () => {
    // NOTIFICATION_CATALOG のキー集合 = NOTIFICATION_TYPES
    expect(Object.keys(NOTIFICATION_CATALOG).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it("各種別に related_id の対象・通知先・担当ストーリーが定義されている", () => {
    for (const type of NOTIFICATION_TYPES) {
      const spec = NOTIFICATION_CATALOG[type];
      expect(spec.relatedIdRefersTo.length).toBeGreaterThan(0);
      expect(spec.recipients.length).toBeGreaterThan(0);
      expect(spec.producedBy.length).toBeGreaterThan(0);
    }
  });

  it("運営からのお知らせは個人向け通知のカタログに含まない（system_announcements で扱う）", () => {
    expect(isNotificationType("announcement")).toBe(false);
    expect(isNotificationType("system_announcement")).toBe(false);
  });

  it("旧来の値 album_ownership_transferred は受け付けない（new_owner に統一）", () => {
    expect(isNotificationType("album_ownership_transferred")).toBe(false);
    expect(isNotificationType("new_owner")).toBe(true);
  });
});
