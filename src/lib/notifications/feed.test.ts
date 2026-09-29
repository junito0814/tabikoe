import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminReportMessage,
  getNotificationFeed,
  moderationActionMessage,
  isNewAnnouncement,
  mergeFeed,
  paginateFeed,
  resolveNotificationHref,
  withinRetention,
  type AnnouncementItem,
  type NotificationLookups,
  type PersonalNotificationItem,
} from "./feed";
import { NOTIFICATION_TYPES } from "./catalog";

/**
 * 出典: docs/tasks/notifications/notification-list/01-notification-list-api.md 単体テスト
 * - notifications と system_announcements が正しくマージ・新着順ソートされることを検証する
 * - ページングパラメータに応じて20件区切りで返されることを検証する
 * 出典: docs/tasks/notifications/notification-list/04-notification-tap-navigation.md 単体テスト
 * - 各 type 値に対して、想定した遷移先が解決されることを検証する
 * - 削除済み等、遷移先が存在しないケースのフォールバック表示を検証する
 * 出典: docs/tasks/notifications/notification-list/05-retention-cutoff.md 単体テスト
 * - 作成から90日を超えた個人向け通知が結果に含まれないことを検証する
 * - 90日以内の通知およびお知らせが除外されないことを検証する
 */
const notification = (id: string, createdAt: string): PersonalNotificationItem => ({
  kind: "notification",
  id,
  type: "like",
  relatedId: "p1",
  isRead: false,
  createdAt,
  message: "m",
  href: "/posts/p1",
  fallbackMessage: null,
});
const announcement = (id: string, publishedAt: string): AnnouncementItem => ({
  kind: "announcement",
  id,
  title: "t",
  body: "b",
  publishedAt,
  isNew: false,
});

describe("mergeFeed / paginateFeed", () => {
  it("個人通知とお知らせを新着順に混在させる", () => {
    const merged = mergeFeed(
      [notification("n1", "2026-09-10T00:00:00Z"), notification("n2", "2026-09-01T00:00:00Z")],
      [announcement("a1", "2026-09-05T00:00:00Z")]
    );
    expect(merged.map((item) => item.id)).toEqual(["n1", "a1", "n2"]);
  });

  it("20件区切りでページングする", () => {
    const items = Array.from({ length: 45 }, (_, i) => notification(`n${i}`, new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString()));
    const first = paginateFeed(items, 0);
    expect(first.items).toHaveLength(20);
    expect(first.nextOffset).toBe(20);
    const third = paginateFeed(items, 40);
    expect(third.items).toHaveLength(5);
    expect(third.nextOffset).toBeNull();
  });
});

describe("resolveNotificationHref", () => {
  const lookups: NotificationLookups = {
    commentPostIds: new Map([["c1", "p1"]]),
    existingPostIds: new Set(["p1"]),
    existingTripIds: new Set(["t1"]),
    existingItineraryIds: new Set(["it1"]),
    reportTargetHrefs: new Map([["r-kept", "/posts/p1"], ["r-deleted", null]]),
  };

  it("v3.0: しおりの通知はしおり詳細へ（消えていれば案内）", () => {
    expect(resolveNotificationHref("itinerary_joined", "it1", lookups)).toEqual({ href: "/itineraries/it1", fallbackMessage: null });
    expect(resolveNotificationHref("itinerary_member_removed", "gone", lookups)).toEqual({ href: null, fallbackMessage: "このしおりは存在しません" });
  });

  it("各 type に対して想定した遷移先", () => {
    expect(resolveNotificationHref("comment", "c1", lookups).href).toBe("/posts/p1");
    expect(resolveNotificationHref("like", "p1", lookups).href).toBe("/posts/p1");
    for (const type of ["album_join", "role_change", "member_removed", "new_owner"] as const) {
      expect(resolveNotificationHref(type, "t1", lookups).href).toBe("/albums/t1");
    }
    expect(resolveNotificationHref("report_resolved", "r-kept", lookups).href).toBe("/posts/p1");
  });

  it("削除済み等はフォールバックメッセージ", () => {
    expect(resolveNotificationHref("comment", "gone", lookups)).toEqual({ href: null, fallbackMessage: "このコメントは削除されました" });
    expect(resolveNotificationHref("like", "gone", lookups)).toEqual({ href: null, fallbackMessage: "この投稿は削除されました" });
    expect(resolveNotificationHref("album_join", "gone", lookups)).toEqual({ href: null, fallbackMessage: "このアルバムは存在しません" });
    expect(resolveNotificationHref("report_resolved", "r-deleted", lookups)).toEqual({ href: null, fallbackMessage: "対象は削除されました" });
    expect(resolveNotificationHref("like", null, lookups).href).toBeNull();
  });

  it("カタログの全 type を扱える", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(() => resolveNotificationHref(type, "x", lookups)).not.toThrow();
    }
  });
});

describe("90日フィルタ", () => {
  const now = new Date("2026-09-14T00:00:00Z");

  it("90日を超えた通知は対象外、90日以内は対象", () => {
    expect(withinRetention("2026-06-15T00:00:00Z", now)).toBe(false);
    expect(withinRetention("2026-06-17T00:00:00Z", now)).toBe(true);
    expect(withinRetention("2026-09-13T00:00:00Z", now)).toBe(true);
  });

  it("一覧取得は notifications にだけ 90 日の条件を付け、お知らせには付けない", async () => {
    const conditions: Record<string, string[]> = {};
    const admin = {
      from: (table: string) => {
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "in"]) q[m] = () => q;
        q.gte = (column: string) => {
          (conditions[table] ??= []).push(`gte:${column}`);
          return q;
        };
        q.lte = (column: string) => {
          (conditions[table] ??= []).push(`lte:${column}`);
          return q;
        };
        q.then = (resolve: (v: unknown) => void) =>
          resolve({
            data:
              table === "system_announcements"
                ? [{ id: "a-old", title: "古いお知らせ", body: "b", published_at: "2025-01-01T00:00:00Z" }]
                : [],
            error: null,
          });
        return q;
      },
    } as unknown as SupabaseClient;

    const page = await getNotificationFeed(admin, "me", 0, now);
    expect(conditions.notifications).toEqual(["gte:created_at"]);
    expect(conditions.system_announcements).toEqual(["lte:published_at"]);
    // 90日より古いお知らせも除外されない
    expect(page.items.map((item) => item.id)).toEqual(["a-old"]);
  });
});

describe("isNewAnnouncement", () => {
  it("7日以内なら新着", () => {
    const now = new Date("2026-09-14T00:00:00Z");
    expect(isNewAnnouncement("2026-09-10T00:00:00Z", now)).toBe(true);
    expect(isNewAnnouncement("2026-09-01T00:00:00Z", now)).toBe(false);
  });
});

describe("Phase 17: 管理者向けの通知（admin-shell-dashboard Task4）", () => {
  const lookups: NotificationLookups = {
    commentPostIds: new Map(),
    existingPostIds: new Set(),
    existingTripIds: new Set(),
    existingItineraryIds: new Set(),
    reportTargetHrefs: new Map(),
    reportTargetTypes: new Map([["r1", "post_review"]]),
    existingUserIds: new Set(["u1"]),
  };

  it("新しい通報は通報詳細へ、文言に対象の種別を足す。通報が消えていれば行き先なし", () => {
    expect(resolveNotificationHref("admin_report", "r1", lookups)).toEqual({ href: "/admin/reports/r1", fallbackMessage: null });
    expect(adminReportMessage("admin_report", "r1", lookups)).toBe("新しい通報：感想テキスト");
    expect(resolveNotificationHref("admin_report", "r9", lookups).href).toBeNull();
    expect(adminReportMessage("comment", "r1", lookups)).toBeNull();
  });

  it("自動非公開は非公開の一覧へ、仮停止は利用者詳細へ（退会済みなら行き先なし）", () => {
    expect(resolveNotificationHref("admin_auto_hidden", "p1", lookups).href).toBe("/admin/hidden");
    expect(resolveNotificationHref("admin_suspended", "u1", lookups).href).toBe("/admin/users/u1");
    expect(resolveNotificationHref("admin_suspended", "u9", lookups)).toEqual({ href: null, fallbackMessage: "この利用者は退会しました" });
  });

  it("Phase 17（strike-system Task2）: 非公開化・削除の通知は対象と理由を含み、アカウントの状態へ", () => {
    const withStrike: NotificationLookups = { ...lookups, strikes: new Map([["s1", { targetLabel: "感想テキスト", reason: "personal_info", action: "hide" }]]) };
    expect(moderationActionMessage("moderation_action", "s1", withStrike)).toBe("感想テキストを非公開にしました。理由：個人情報の掲載。詳しくは「アカウントの状態」で確認できます");
    expect(moderationActionMessage("moderation_action", "s9", withStrike)).toBeNull();
    expect(resolveNotificationHref("moderation_action", "s1", withStrike).href).toBe("/account/status");
  });
});
