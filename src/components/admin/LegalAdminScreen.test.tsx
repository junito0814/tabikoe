import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LegalAdminScreen, suggestNextVersion } from "./LegalAdminScreen";

/** 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md 単体テスト */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const versions = [
  { id: "d2", version: "1.3", status: "draft" as const, summary: "", publishedAt: null, updatedAt: "2026-09-27T00:00:00Z", consentedCount: 0 },
  { id: "d1", version: "1.2", status: "published" as const, summary: "", publishedAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z", consentedCount: 121 },
  { id: "d0", version: "1.1", status: "archived" as const, summary: "", publishedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", consentedCount: 80 },
];

describe("LegalAdminScreen", () => {
  it("版の一覧に下書き／公開中／過去と同意済み人数が出て、公開中の次の版が初期値になる", () => {
    render(<LegalAdminScreen kind="terms" draft={null} versions={versions.slice(1)} totalUsers={128} />);
    expect(screen.getByDisplayValue("1.3")).toBeInTheDocument();
    expect(screen.getByText("121/128人")).toBeInTheDocument();
    expect(screen.getByText(/9\/10 公開中/)).toBeInTheDocument();
    expect(suggestNextVersion("1.9")).toBe("1.10");
    expect(suggestNextVersion(null)).toBe("1.0");
  });

  it("「この版を公開する」は確認を経て、保存 → 公開の順で API を呼ぶ", async () => {
    const api = {
      saveDraft: vi.fn(async () => Response.json({ ok: true, id: "d2" })),
      publish: vi.fn(async () => Response.json({ ok: true })),
    };
    render(<LegalAdminScreen kind="terms" draft={{ id: "d2", kind: "terms", version: "1.3", summary: "要点", body: "# 本文", status: "draft", publishedAt: null }} versions={versions} totalUsers={128} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "この版を公開する" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith("d2"));
    expect(api.saveDraft).toHaveBeenCalledWith({ kind: "terms", id: "d2", version: "1.3", summary: "要点", body: "# 本文" });
    expect(await screen.findByRole("status")).toHaveTextContent("版 1.3 を公開しました");
  });

  it("公開中より新しくない版は保存できず、その旨を出す", async () => {
    const api = { saveDraft: vi.fn(async () => Response.json({ error: "version_not_newer" }, { status: 409 })), publish: vi.fn() };
    render(<LegalAdminScreen kind="privacy" draft={null} versions={versions.slice(1)} totalUsers={128} api={api} />);
    fireEvent.change(screen.getByLabelText(/^本文/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(screen.getByText(/版は公開中（1.2）より大きい番号/)).toBeInTheDocument());
  });
});
