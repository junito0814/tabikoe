import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpotStatusButtons } from "./SpotStatusButtons";

/**
 * 出典: docs/tasks/browsing/spot-status-report/02-detail-buttons-and-display.md 単体テスト
 * - 自分の報告が選択状態で表示されること
 * 出典: docs/tasks/browsing/spot-status-report/03-embed-latest-status.md 単体テスト
 * - 報告が無いスポットでラベルが描画されないこと
 */
describe("SpotStatusButtons", () => {
  it("自分の報告が選択状態で表示され、最新の報告がラベルに出る", () => {
    render(
      <SpotStatusButtons
        spotId="s1"
        initial={{ latest: { status: "gone", reportedAt: "2026-08-20T00:00:00Z" }, mine: { status: "still_there", reportedAt: "2026-07-01T00:00:00Z" } }}
      />
    );
    expect(screen.getByRole("button", { name: "まだあった" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "無くなっていた" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("8月に無くなっていたとの報告")).toBeInTheDocument();
  });

  it("報告が無ければラベルを出さず、押すと API を呼んで即時反映する", async () => {
    const submit = vi.fn(async () => ({
      latest: { status: "still_there" as const, reportedAt: "2026-09-05T00:00:00Z" },
      mine: { status: "still_there" as const, reportedAt: "2026-09-05T00:00:00Z" },
    }));
    render(<SpotStatusButtons spotId="s1" initial={{ latest: null, mine: null }} submit={submit} />);
    expect(document.querySelector("[data-spot-status]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "まだあった" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("s1", "still_there"));
    expect(await screen.findByText("9月にまだあった")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "まだあった" })).toHaveAttribute("aria-pressed", "true");
  });

  it("失敗したら元に戻して案内を出す", async () => {
    const submit = vi.fn(async () => {
      throw new Error("boom");
    });
    render(<SpotStatusButtons spotId="s1" initial={{ latest: null, mine: null }} submit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "無くなっていた" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("報告できませんでした");
    expect(screen.getByRole("button", { name: "無くなっていた" })).toHaveAttribute("aria-pressed", "false");
  });
});
