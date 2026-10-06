import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { useConfirm } from "./ConfirmSheet";
import { acceptConfirm, confirmSheetText, rejectConfirm } from "./confirm-sheet.testing";

/**
 * 出典: Issue #778「Bug 3: 確認がブラウザ標準のダイアログ（12 か所）」
 */
function Sample({ onAnswer, danger = true }: { onAnswer: (answer: boolean) => void; danger?: boolean }) {
  const { confirm, confirmSheet } = useConfirm();
  return (
    <div>
      {confirmSheet}
      <button
        type="button"
        onClick={async () => {
          onAnswer(await confirm({ title: "このコメントを削除しますか？", description: "取り消せません。", confirmLabel: "削除", danger }));
        }}
      >
        削除する
      </button>
    </div>
  );
}

const ask = () => fireEvent.click(screen.getByRole("button", { name: "削除する" }));

describe("useConfirm（#778）", () => {
  it("押すまで何も起きず、出てくるのは見出し・説明・「やめる」「〈動詞〉」の 2 つ", async () => {
    render(<Sample onAnswer={vi.fn()} />);
    expect(document.querySelector("[data-confirm-sheet]")).toBeNull();
    ask();
    await waitFor(() => expect(document.querySelector("[data-confirm-sheet]")).toBeInTheDocument());
    const text = confirmSheetText();
    expect(text).toContain("このコメントを削除しますか？");
    expect(text).toContain("取り消せません。");
    expect(screen.getByRole("button", { name: "やめる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("「削除」で true、「やめる」で false を返す", async () => {
    const onAnswer = vi.fn();
    render(<Sample onAnswer={onAnswer} />);
    ask();
    await acceptConfirm();
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));

    ask();
    await rejectConfirm();
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it("答えたらシートは閉じる", async () => {
    render(<Sample onAnswer={vi.fn()} />);
    ask();
    await acceptConfirm();
    expect(document.querySelector("[data-confirm-sheet]")).toBeNull();
  });

  it("Esc・背景タップは「やめる」と同じ（false）", async () => {
    const onAnswer = vi.fn();
    render(<Sample onAnswer={onAnswer} />);
    ask();
    await waitFor(() => expect(document.querySelector("[data-confirm-sheet]")).toBeInTheDocument());
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it("取り消せない操作は右のボタンが赤、そうでなければ青", async () => {
    const { unmount } = render(<Sample onAnswer={vi.fn()} />);
    ask();
    await waitFor(() => expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "削除" }).className).toContain("bg-saved");
    unmount();

    render(<Sample onAnswer={vi.fn()} danger={false} />);
    ask();
    await waitFor(() => expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "削除" }).className).toContain("bg-accent");
  });
});

/**
 * #778 の受入条件: `src/components` に `window.confirm`／`window.prompt`／`alert(` が無い（管理画面も含む）。
 * 【初心者向け】1 か所でも残っていると、そこだけ iPhone で「localhost:3000 の内容」が出る。
 * 見落としを防ぐため、ファイルを読んで機械的に確かめる。
 */
describe("ブラウザ標準のダイアログが残っていない（#778）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");

  it.each([
    ["window.confirm(", "window.confirm("],
    ["window.prompt(", "window.prompt("],
    ["window.alert(", "window.alert("],
  ])("%s を使っているファイルが無い", (_label, needle) => {
    const offenders = files.filter((path) => readFileSync(path, "utf8").includes(needle));
    expect(offenders).toEqual([]);
  });
});
