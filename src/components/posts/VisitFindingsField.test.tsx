import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisitFindingsField } from "./VisitFindingsField";

/**
 * #929: 投稿画面の「行ってわかったこと（任意）」
 * 出典: Issue #929、要件定義書 4.5.19
 */
describe("VisitFindingsField", () => {
  it("既定は畳んでいて、中身は出ていない", () => {
    render(<VisitFindingsField value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("ペット")).toBeNull();
  });

  it("選んでいれば「N つ選択中」が出る（開かなくても分かる）", () => {
    render(<VisitFindingsField value={["pet", "parking"]} onChange={vi.fn()} />);
    expect(screen.getByText("2 つ選択中")).toBeInTheDocument();
  });

  it("開くと 4 グループ・11 項目が出る", () => {
    render(<VisitFindingsField value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    for (const label of ["入れた", "あった", "平気だった", "支払い"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("checkbox")).toHaveLength(11);
  });

  it("押すと選ばれ、もう一度押すと外れる", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VisitFindingsField value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByLabelText("ペット"));
    expect(onChange).toHaveBeenLastCalledWith(["pet"]);

    rerender(<VisitFindingsField value={["pet"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("ペット"));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  // 要件 4.5.19: 見出しが動詞を持つので、項目は単語のまま（「車椅子で入れた」とは書かない）
  it("項目は単語で出す", () => {
    render(<VisitFindingsField value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByLabelText("車椅子")).toBeInTheDocument();
    expect(screen.queryByLabelText("車椅子で入れた")).toBeNull();
  });
});
