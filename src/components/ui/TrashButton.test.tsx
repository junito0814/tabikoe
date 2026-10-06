import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { TrashButton } from "./TrashButton";

/**
 * 出典: #695（削除ボタンをゴミ箱の印にする。全画面）単体テスト
 * ワイヤーフレーム決定事項 74④
 */
describe("TrashButton", () => {
  it("印だけで、「削除」の文字は出さない", () => {
    render(<TrashButton onClick={vi.fn()} label="この投稿を削除" />);
    const button = screen.getByRole("button", { name: "この投稿を削除" });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  /** 【初心者向け】印だけだと耳では分からないので、読み上げ用の名前は必ず要る */
  it("読み上げ用の名前に「削除」が残る", () => {
    render(<TrashButton onClick={vi.fn()} label="下書き「東京駅」を削除" />);
    expect(screen.getByLabelText("下書き「東京駅」を削除")).toBeInTheDocument();
  });

  it("押すと呼ばれる。消している最中は押せない", () => {
    const onClick = vi.fn();
    const { rerender } = render(<TrashButton onClick={onClick} label="削除" />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();

    rerender(<TrashButton onClick={onClick} label="削除" busy />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });
});

/**
 * 写しを作らせないための見張り（約束 14）。
 * ゴミ箱の形が 2 か所に書かれると、片方だけ直してズレる。
 */
describe("削除を出す画面は、この部品を使う", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("コメント・しおりの行・下書きの 3 つ", () => {
    for (const path of [
      "src/components/comments/CommentSection.tsx",
      "src/components/itineraries/ItinerarySpotRow.tsx",
      "src/components/mypage/DraftsSection.tsx",
    ]) {
      expect(read(path), `${path} が TrashButton を使っていない`).toContain("<TrashButton");
    }
  });

  /**
   * #742（2026-10-06）: アルバムの削除だけは**印ではなく「⋯」のメニューの中**に移した。
   * しおり詳細が既に同じ形で、画面に赤いものを出さずに済むため。
   */
  it("アルバムの削除は「⋯」のメニューの中（ゴミ箱の印ではない）", () => {
    const source = read("src/components/albums/AlbumScreen.tsx");
    expect(source).not.toContain("<TrashButton");
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("このアルバムを削除");
  });

  /** 確認ダイアログの文言は変えない（取り消せない操作の説明は文字で残す） */
  it("投稿の削除は、確認ダイアログの文言をそのまま残している", () => {
    const source = read("src/components/posts/DeletePostButton.tsx");
    expect(source).toContain("投稿を削除しますか");
    expect(source).toContain("元に戻すことはできません");
  });
});
