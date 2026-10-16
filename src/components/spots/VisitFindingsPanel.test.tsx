import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisitFindingsPanel } from "./VisitFindingsPanel";
import type { VisitFindingSummary } from "@/lib/spots/visit-findings-db";

/**
 * #929: スポット画面の「行ってわかったこと」
 * 出典: Issue #929、要件定義書 4.5.19・3.4.2
 */
const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();
const old = new Date(Date.now() - 500 * 86_400_000).toISOString();

const summaries: VisitFindingSummary[] = [
  { finding: "pet", count: 3, latestAt: recent },
  { finding: "parking", count: 2, latestAt: old },
];

describe("VisitFindingsPanel", () => {
  // 要件 4.5.19: 0 件なら「ペット不可」とは絶対に書かない ── 行ごと出さない
  it("報告が 1 件も無ければ、何も出さない", () => {
    const { container } = render(<VisitFindingsPanel summaries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("畳んでいるときは件数だけ（中身は出ていない）", () => {
    render(<VisitFindingsPanel summaries={summaries} />);
    expect(screen.getByText("5 件")).toBeInTheDocument();
    expect(screen.queryByText("ペット")).toBeNull();
  });

  it("開くと、報告のあるグループだけ出る", () => {
    render(<VisitFindingsPanel summaries={summaries} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("入れた")).toBeInTheDocument();
    expect(screen.getByText("あった")).toBeInTheDocument();
    // 報告が無いグループの見出しは出さない
    expect(screen.queryByText("平気だった")).toBeNull();
    expect(screen.queryByText("支払い")).toBeNull();
  });

  it("項目は単語のまま、件数といつの報告かを添える", () => {
    render(<VisitFindingsPanel summaries={summaries} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("ペット")).toBeInTheDocument();
    expect(screen.getByText("今月")).toBeInTheDocument();
    expect(screen.getByText("1 年以上前")).toBeInTheDocument();
    // 割合は出さない（分母が作れないため）
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
