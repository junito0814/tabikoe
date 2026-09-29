import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HiddenItemsScreen } from "./HiddenItemsScreen";
import type { HiddenItem } from "@/lib/admin/hidden-items";

/** 出典: docs/tasks/admin/user-management/03-hidden-items.md 単体テスト */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const items: HiddenItem[] = [
  { kind: "post", id: "p1", hiddenAt: new Date().toISOString(), label: "投稿「たこ焼き〇〇」", authorName: "はなこ", authorId: "u1", reason: "異なる通報者 3 人（personal_info×2）", reportId: "r1", href: "/posts/p1" },
];

describe("HiddenItemsScreen", () => {
  it("3 タブが出て、自動のタブでは「問題なし・元に戻す」、通報詳細へのリンクがある", () => {
    render(<HiddenItemsScreen tab="auto" counts={{ auto: 1 }} initialPage={{ items, nextOffset: null }} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /自動で非公開/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "問題なし・元に戻す" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "通報を見る" })).toHaveAttribute("href", "/admin/reports/r1");
    expect(screen.getByText("異なる通報者 3 人（personal_info×2）")).toBeInTheDocument();
  });

  it("復元は理由が無いと送らず、理由を入れると API を呼んで行が消える", async () => {
    const restore = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<HiddenItemsScreen tab="admin" counts={{}} initialPage={{ items, nextOffset: null }} restore={restore} />);
    fireEvent.click(screen.getByRole("button", { name: "復元" }));
    fireEvent.click(screen.getByRole("button", { name: "復元する" }));
    expect(screen.getByText("理由を入力してください")).toBeInTheDocument();
    expect(restore).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("理由（必須）"), { target: { value: "誤判定" } });
    fireEvent.click(screen.getByRole("button", { name: "復元する" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith("post", "p1", "誤判定"));
    await waitFor(() => expect(screen.queryByText("投稿「たこ焼き〇〇」")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("復元しました");
  });
});
