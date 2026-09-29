import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminActionsScreen, buildAdminActionParams } from "./AdminActionsScreen";
import type { AdminActionItem } from "@/lib/admin/admin-actions";

/** 出典: docs/tasks/admin/user-management/04-admin-actions-log.md 単体テスト */
const rows: AdminActionItem[] = [
  { id: "a1", actorId: "admin-1", actorName: "たろう", isAutomatic: false, action: "report_hide", targetType: "post", targetId: "p1", targetLabel: "投稿「たこ焼き」", note: "電話番号", createdAt: "2026-09-26T09:12:00Z" },
  { id: "a2", actorId: null, actorName: "自動", isAutomatic: true, action: "auto_hide", targetType: "post", targetId: "p1", targetLabel: "投稿「たこ焼き」", note: "異なる通報者 3 人", createdAt: "2026-09-26T08:50:00Z" },
];

describe("AdminActionsScreen", () => {
  it("記録を表に出し、自動処理は「自動」と表示する", () => {
    render(<AdminActionsScreen initialPage={{ actions: rows, nextOffset: null }} admins={[{ id: "admin-1", name: "たろう" }]} />);
    expect(screen.getByRole("cell", { name: "たろう" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "非公開化" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "自動で非公開" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "自動" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("絞り込みの「表示」で 1 ページ目から取り直し、「もっと見る」は続きを足す", async () => {
    const fetchActions = vi.fn(async (params: URLSearchParams) => {
      const offset = Number(params.get("offset") ?? "0");
      return { actions: [{ ...rows[0], id: `x${offset}` }], nextOffset: offset + 1 };
    });
    render(<AdminActionsScreen initialPage={{ actions: rows, nextOffset: 2 }} admins={[]} fetchActions={fetchActions} />);
    fireEvent.change(screen.getByLabelText("操作"), { target: { value: "auto_hide" } });
    fireEvent.click(screen.getByRole("button", { name: "表示" }));
    await waitFor(() => expect(fetchActions).toHaveBeenCalledTimes(1));
    expect(fetchActions.mock.calls[0][0].get("action")).toBe("auto_hide");
    expect(fetchActions.mock.calls[0][0].get("offset")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchActions).toHaveBeenCalledTimes(2));
    expect(fetchActions.mock.calls[1][0].get("offset")).toBe("1");
    expect(fetchActions.mock.calls[1][0].get("action")).toBe("auto_hide");
  });

  it("buildAdminActionParams は空の条件を乗せない", () => {
    expect(buildAdminActionParams({ actor: "", action: "", from: "", to: "" }, 0).toString()).toBe("");
    expect(buildAdminActionParams({ actor: "auto", action: "", from: "2026-09-01", to: "" }, 20).toString()).toBe("actor=auto&from=2026-09-01&offset=20");
  });

  it("#585: 退会した管理者の行は「自動」ではなく「〈名前〉（退会済み）」と出る", () => {
    render(
      <AdminActionsScreen
        initialPage={{ actions: [{ ...rows[0], id: "a3", actorId: null, actorName: "たろう（退会済み）", isAutomatic: false }], nextOffset: null }}
        admins={[]}
      />
    );
    expect(screen.getByRole("cell", { name: "たろう（退会済み）" })).toBeInTheDocument();
    // 「自動」は絞り込みの選択肢にもあるので、表の中だけを見る
    expect(screen.queryByRole("cell", { name: "自動" })).not.toBeInTheDocument();
  });
});
