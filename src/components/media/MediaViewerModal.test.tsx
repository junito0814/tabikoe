import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MediaViewerModal } from "./MediaViewerModal";
import type { MediaItem } from "./MediaGrid";

/**
 * 出典: docs/tasks/shared-ui/media-viewer/01-media-viewer-modal.md 単体テスト
 * - ←→ ボタン・矢印キー・スワイプで前後に移動し、端では止まること
 * - Esc・閉じるボタン・背景タップで閉じること
 * - 動画はモーダル内で再生されること
 */
const items: MediaItem[] = [
  { id: "a", mediaType: "photo", thumbnailUrl: "https://example.com/a.jpg", alt: "写真 1" },
  { id: "b", mediaType: "video", thumbnailUrl: "https://example.com/b.jpg", alt: "動画 2", videoUrl: "https://example.com/b.mp4" },
  { id: "c", mediaType: "photo", thumbnailUrl: "https://example.com/c.jpg", alt: "写真 3" },
];

function Harness({ initialIndex = 0, onClose = vi.fn() }: { initialIndex?: number; onClose?: () => void }) {
  // index を親が持つ実際の使い方に合わせる
  const [index, setIndex] = useState(initialIndex);
  return <MediaViewerModal items={items} index={index} onIndexChange={setIndex} onClose={onClose} />;
}

describe("MediaViewerModal", () => {
  it("開いた位置の写真と「n / N」を表示し、→ ← で移動できる", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("1 / 3");
    expect(screen.getByAltText("写真 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(dialog).toHaveTextContent("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(dialog).toHaveTextContent("3 / 3");
    fireEvent.click(screen.getByRole("button", { name: "前へ" }));
    expect(dialog).toHaveTextContent("2 / 3");
  });

  it("先頭では「前へ」、末尾では「次へ」が無効になり、ループしない", () => {
    render(<Harness initialIndex={2} />);
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前へ" })).toBeEnabled();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveTextContent("3 / 3");
  });

  it("矢印キーで移動し、Esc で閉じる（7.7 キーボード操作）", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveTextContent("2 / 3");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 3");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("左右スワイプで移動する", () => {
    render(<Harness />);
    const stage = screen.getByAltText("写真 1").parentElement!;

    fireEvent.touchStart(stage, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByRole("dialog")).toHaveTextContent("2 / 3");

    fireEvent.touchStart(stage, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 220 }] });
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 3");
  });

  it("小さな横移動（しきい値未満）ではスワイプ扱いにしない", () => {
    render(<Harness />);
    const stage = screen.getByAltText("写真 1").parentElement!;
    fireEvent.touchStart(stage, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 180 }] });
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 3");
  });

  it("動画の位置ではモーダル内に video 要素が出る", () => {
    render(<Harness initialIndex={1} />);
    const video = screen.getByLabelText("動画 2");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "https://example.com/b.mp4");
    expect(video).toHaveAttribute("controls");
  });

  it("閉じるボタンと背景タップで閉じ、写真自体のタップでは閉じない", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByAltText("写真 1"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("1点だけなら ←→ ボタンを出さない", () => {
    render(
      <MediaViewerModal items={[items[0]]} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: "次へ" })).toBeNull();
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 1");
  });

  it("link を渡すと位置ごとの導線を表示する", () => {
    render(
      <MediaViewerModal
        items={items}
        index={1}
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
        link={(item) => ({ href: `/posts/${item.id}`, label: "この投稿を見る" })}
      />
    );
    expect(screen.getByRole("link", { name: "この投稿を見る" })).toHaveAttribute("href", "/posts/b");
  });
});
