import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Select } from "./Select";

/**
 * 出典: Issue #812「自前のドロップダウンをやめ、ブラウザ標準の select に統一する」
 */
describe("Select（#812）", () => {
  const options = ["newest", "rating"] as const;
  const label = (option: (typeof options)[number]) => (option === "newest" ? "新着順" : "評価順");

  it("ブラウザ標準の <select>（combobox）である ── スマホでは OS の選択画面が開く", () => {
    render(<Select value="newest" onChange={vi.fn()} options={options} label={label} ariaLabel="並び替え" />);
    const select = screen.getByRole("combobox", { name: "並び替え" });
    expect(select.tagName).toBe("SELECT");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["新着順", "評価順"]);
  });

  it("選ぶと onChange に値が来る（キーボードでも同じ経路）", () => {
    const onChange = vi.fn();
    render(<Select value="newest" onChange={onChange} options={options} label={label} ariaLabel="並び替え" />);
    fireEvent.change(screen.getByRole("combobox", { name: "並び替え" }), { target: { value: "rating" } });
    expect(onChange).toHaveBeenCalledWith("rating");
  });

  it("見た目は丸いボタン。ブラウザ既定の矢印を消し、同じ位置に自分の ⌄ を置く", () => {
    const { container } = render(<Select value="newest" onChange={vi.fn()} options={options} label={label} ariaLabel="並び替え" />);
    const select = screen.getByRole("combobox", { name: "並び替え" });
    expect(select.className).toContain("rounded-full");
    expect(select.className).toContain("appearance-none");
    // ⌄ を押しても <select> が開くよう、矢印は指を通す
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("pointer-events-none");
  });

  it("disabled を渡すと選べない", () => {
    render(<Select value="newest" onChange={vi.fn()} options={options} label={label} ariaLabel="並び替え" disabled />);
    expect(screen.getByRole("combobox", { name: "並び替え" })).toBeDisabled();
  });

  it("label を省略すると値をそのまま出す", () => {
    render(<Select value="newest" onChange={vi.fn()} options={options} ariaLabel="並び替え" />);
    expect(within(screen.getByRole("combobox")).getAllByRole("option").map((o) => o.textContent)).toEqual(["newest", "rating"]);
  });
});

/**
 * #812 の受入条件: `SortDropdown` が残っていない。
 * 【初心者向け】自前のリストが 1 つでも残ると、そこだけスマホの OS の選択画面が出ず、
 * 文字サイズ設定にも追随しません。ファイルを読んで機械的に確かめます。
 */
describe("自前のドロップダウンが残っていない（#812）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry)) files.push(path);
    }
  };
  walk("src");

  it("SortDropdown というファイルが無く、import しているファイルも無い", () => {
    expect(files.filter((path) => path.includes("SortDropdown"))).toEqual([]);
    // 「なぜやめたか」を書いたコメントは残しているので、import だけを見る
    const offenders = files.filter((path) => path !== "src/components/ui/Select.test.tsx" && /import .*SortDropdown|<SortDropdown/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
