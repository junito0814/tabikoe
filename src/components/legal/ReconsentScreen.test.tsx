import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReconsentScreen } from "./ReconsentScreen";

/** 出典: docs/tasks/admin/legal-documents/03-reconsent.md 単体テスト */
// #705（2026-10-05）: 同意の状態が変わった直後なので、ルーターではなく読み込み直す
const hardRedirect = vi.fn();
vi.mock("@/lib/navigation/hard-redirect", () => ({ hardRedirect: (href: string) => hardRedirect(href) }));

describe("ReconsentScreen", () => {
  it("変更の要点と全文リンクが出て、チェックしないと押せない。チェックすると API を呼んで元の場所へ", async () => {
    const submit = vi.fn(async () => Response.json({ ok: true }));
    render(<ReconsentScreen items={[{ kind: "terms", version: "1.3", summary: "・違反の記録を 90 日保持" }]} redirectTo="/mypage" submit={submit} />);
    expect(screen.getByText("利用規約が変わりました（1.3）")).toBeInTheDocument();
    expect(screen.getByText("・違反の記録を 90 日保持")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "全文を読む →" })).toHaveAttribute("href", "/terms");
    const button = screen.getByRole("button", { name: "同意して続ける" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText("利用規約に同意する"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(["terms"]));
    await waitFor(() => expect(hardRedirect).toHaveBeenCalledWith("/mypage"));
  });

  it("2 種類とも変わったときは両方にチェックが要る", () => {
    render(<ReconsentScreen items={[{ kind: "terms", version: "1.3", summary: "" }, { kind: "privacy", version: "1.1", summary: "" }]} redirectTo="/" />);
    fireEvent.click(screen.getByLabelText("利用規約に同意する"));
    expect(screen.getByRole("button", { name: "同意して続ける" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("個人情報保護方針に同意する"));
    expect(screen.getByRole("button", { name: "同意して続ける" })).toBeEnabled();
  });
});
