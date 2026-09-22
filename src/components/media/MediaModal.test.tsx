import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MediaModal } from "./MediaModal";
import type { MediaItem } from "./MediaGrid";

/**
 * 出典: docs/tasks/shared-ui/media-viewer/00-index.md（写真のモーダル）
 * - Bug #492: モーダルは body 直下（上 1/3 地図＋シートの枠の外）に出て、メニューバーの手前で止まる
 * - ←→ で移動、閉じる
 */
const items: MediaItem[] = [
  { id: "a", mediaType: "photo", thumbnailUrl: "https://example.com/a.jpg", alt: "写真 a" },
  { id: "b", mediaType: "photo", thumbnailUrl: "https://example.com/b.jpg", alt: "写真 b" },
];

describe("MediaModal（写真のモーダル）", () => {
  it("Bug #492: relative z-10 の枠の中で開いても body 直下に出て、メニューバー分（下 60px）を空ける", () => {
    const { container } = render(
      <div className="relative z-10">
        <MediaModal items={items} startIndex={0} onClose={vi.fn()} />
      </div>
    );
    const modal = document.querySelector("[data-media-modal]") as HTMLElement;
    expect(modal.parentElement).toBe(document.body);
    expect(container.querySelector("[data-media-modal]")).toBeNull();
    expect(modal).toHaveClass("z-50");
    expect(modal).toHaveClass("[body:has([data-menu-bar])_&]:bottom-[60px]");
  });

  it("次へ／前へで写真が変わり、閉じるで onClose", () => {
    const onClose = vi.fn();
    render(<MediaModal items={items} startIndex={0} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "写真 a" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("dialog", { name: "写真 b" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });
});
