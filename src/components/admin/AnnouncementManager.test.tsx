import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnnouncementManager, type AnnouncementApi } from "./AnnouncementManager";

/**
 * 出典: docs/tasks/admin/announcement-management/03-announcement-management-ui.md 単体テスト
 * - 文字数超過時にフォームが送信をブロックし、エラー表示を行うことを検証する
 */
const api = (overrides: Partial<AnnouncementApi> = {}): AnnouncementApi => ({
  create: vi.fn(async () =>
    Response.json({ announcement: { id: "a1", title: "t", body: "b", published_at: "2026-09-14T00:00:00Z", created_at: "x", updated_at: "x" } }, { status: 201 })
  ),
  update: vi.fn(async () => Response.json({})),
  remove: vi.fn(async () => Response.json({ deleted: true })),
  ...overrides,
});

describe("AnnouncementManager（SC-17）", () => {
  it("タイトルが100文字を超えると送信をブロックしてエラーを表示する", async () => {
    const create = vi.fn();
    render(<AnnouncementManager initialAnnouncements={[]} api={api({ create })} />);
    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: "あ".repeat(101) } });
    fireEvent.change(screen.getByLabelText(/本文/), { target: { value: "本文" } });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    expect(await screen.findByText("タイトルは100文字までです")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("本文が2,000文字を超えると送信をブロックする", async () => {
    const create = vi.fn();
    render(<AnnouncementManager initialAnnouncements={[]} api={api({ create })} />);
    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: "お知らせ" } });
    fireEvent.change(screen.getByLabelText(/本文/), { target: { value: "あ".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    expect(await screen.findByText("本文は2,000文字までです")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("上限内なら作成 API を呼び、一覧の先頭に追加される", async () => {
    const create = vi.fn(async () =>
      Response.json({ announcement: { id: "a1", title: "新着", body: "本文", published_at: "2026-09-14T00:00:00Z", created_at: "x", updated_at: "x" } }, { status: 201 })
    );
    render(<AnnouncementManager initialAnnouncements={[]} api={api({ create })} />);
    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: "新着" } });
    fireEvent.change(screen.getByLabelText(/本文/), { target: { value: "本文" } });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: "新着", body: "本文" })));
    expect(await screen.findByText("新着")).toBeInTheDocument();
  });
});
