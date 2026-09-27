import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminDashboardScreen, relativeTime } from "./AdminDashboardScreen";
import type { AdminDashboardData } from "@/lib/admin/dashboard";

/** 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md 単体テスト */
const base: AdminDashboardData = {
  needsAction: { openReports: { count: 0, oldestDays: null }, autoHiddenPending: 0, provisionalSuspensions: 0 },
  counts: { users: { total: 128, thisWeek: 12 }, posts: { total: 340, thisWeek: 25 }, spots: { total: 96, manual: 41 }, activeUsers: null },
  recentPosts: [{ id: "p1", spotName: "かっぱ橋", authorName: "はなこ", category: "ショッピング", isPublic: true, publishedAt: "2026-09-27T00:00:00Z" }],
  recentSpots: [],
  concentratedTargets: [{ targetType: "post", targetId: "p1", label: "たこ焼き〇〇の投稿", reporterCount: 3, latestAt: "2026-09-27T00:00:00Z", href: "/admin/reports?status=open&target_type=post&target_id=p1" }],
};

describe("AdminDashboardScreen", () => {
  it("0 件のときは緑の帯「ありません」で、ボタンは出ない", () => {
    render(<AdminDashboardScreen data={base} />);
    const section = screen.getByRole("region", { name: "対応が要るもの" });
    expect(within(section).getAllByText("ありません")).toHaveLength(3);
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
    expect(section.querySelectorAll('[data-alert="none"]')).toHaveLength(3);
  });

  it("N 件のときは赤い帯と最古の日数、対応へのリンク（未対応・古い順）", () => {
    const data = { ...base, needsAction: { ...base.needsAction, openReports: { count: 3, oldestDays: 5 } } };
    render(<AdminDashboardScreen data={data} />);
    const section = screen.getByRole("region", { name: "対応が要るもの" });
    expect(within(section).getByText("3 件")).toBeInTheDocument();
    expect(within(section).getByText("いちばん古いもの 5 日前")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /対応/ })).toHaveAttribute("href", "/admin/reports?status=open&sort=oldest");
  });

  it("数字と今週の増分、使った人の記録が無ければ「—」", () => {
    render(<AdminDashboardScreen data={base} />);
    expect(screen.getByText("128 人")).toBeInTheDocument();
    expect(screen.getByText("今週 +12")).toBeInTheDocument();
    expect(screen.getByText("うち 41 タビコエだけの場所")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("最近の投稿の「見る」は利用者向けの画面を新しいタブで開き、集中している対象は通報一覧へ", () => {
    render(<AdminDashboardScreen data={base} />);
    const view = screen.getByRole("link", { name: /見る/ });
    expect(view).toHaveAttribute("href", "/posts/p1");
    expect(view).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute("href", "/admin/reports?status=open&target_type=post&target_id=p1");
  });

  it("relativeTime", () => {
    const now = new Date("2026-09-27T12:00:00Z");
    expect(relativeTime("2026-09-27T10:00:00Z", now)).toBe("2時間前");
    expect(relativeTime("2026-09-26T10:00:00Z", now)).toBe("昨日");
    expect(relativeTime("2026-09-24T10:00:00Z", now)).toBe("3日前");
    expect(relativeTime("2026-09-01T10:00:00Z", now)).toBe("9/1");
  });
});
