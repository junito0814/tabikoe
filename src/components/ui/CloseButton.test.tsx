import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CloseButton } from "./CloseButton";

/**
 * 出典: #712（「×」を右上に統一する）単体テスト
 * 要件定義書 4.5.13・ワイヤーフレーム決定事項 80
 */
describe("CloseButton", () => {
  it("× の形で、文字の「閉じる」は出さない", () => {
    render(<CloseButton onClick={vi.fn()} />);
    const button = screen.getByRole("button", { name: "閉じる" });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("押すと閉じる", () => {
    const onClick = vi.fn();
    render(<CloseButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClick).toHaveBeenCalled();
  });

  /** 【初心者向け】指で押せる大きさ（32px）を割らないように固定する */
  it("触る指に合う大きさがある", () => {
    render(<CloseButton onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "閉じる" }).className).toContain("h-8 w-8");
  });
});

/**
 * 写しを作らせないための見張り（約束 14）。
 * × の形が 2 か所に書かれると、片方だけ直してズレる。
 */
describe("閉じるを出す画面は、この部品を使う", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("シート・絞り込み・写真の拡大・通知・アルバム作成・ピンの吹き出し・バッジの知らせ", () => {
    for (const path of [
      "src/components/ui/Sheet.tsx",
      "src/components/posts/FilterSheet.tsx",
      "src/components/media/MediaModal.tsx",
      "src/components/notifications/NotificationListScreen.tsx",
      "src/components/albums/AlbumListControls.tsx",
      "src/components/map/PinCallout.tsx",
      "src/components/badges/BadgeToast.tsx",
    ]) {
      expect(read(path), `${path} が CloseButton を使っていない`).toContain("<CloseButton");
    }
  });

  it("文字の「閉じる」ボタンが残っていない", () => {
    for (const path of ["src/components/ui/Sheet.tsx", "src/components/posts/FilterSheet.tsx", "src/components/media/MediaModal.tsx"]) {
      expect(read(path), path).not.toContain(">\n            閉じる\n          </button>");
      expect(read(path), path).not.toContain(">\n          閉じる\n        </button>");
    }
  });

  /** 背景のタップで閉じるのは残す（× を足しただけ） */
  it("背景のタップは残っている", () => {
    for (const path of ["src/components/ui/Sheet.tsx", "src/components/posts/FilterSheet.tsx"]) {
      expect(read(path), path).toContain('aria-label="閉じる" onClick={onClose} className="absolute inset-0 bg-black/40"');
    }
  });
});
