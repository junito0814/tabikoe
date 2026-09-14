import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MediaGrid, type MediaItem } from "./MediaGrid";

/**
 * 出典: docs/tasks/shared-ui/media-layout/01-grid-layout-component.md 単体テスト
 *       docs/tasks/shared-ui/media-layout/02-overflow-count-badge.md 単体テスト
 *       docs/tasks/shared-ui/media-layout/03-video-thumbnail-inline-playback.md 単体テスト
 */
function makeItems(count: number, options: { videoFirst?: boolean } = {}): MediaItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    mediaType: options.videoFirst && i === 0 ? "video" : "photo",
    thumbnailUrl: `https://example.com/${i}.jpg`,
    alt: `写真${i + 1}`,
    videoUrl: options.videoFirst && i === 0 ? "https://example.com/0.mp4" : undefined,
  }));
}

describe("MediaGrid レイアウト（Task1）", () => {
  it("0点なら何も描画しない", () => {
    const { container } = render(<MediaGrid items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("1点は全幅で1要素", () => {
    render(<MediaGrid items={makeItems(1)} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("2点は左右2分割で2要素", () => {
    render(<MediaGrid items={makeItems(2)} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("3点は3要素、1点目が左の大きい枠（row-span-2）に入る", () => {
    render(<MediaGrid items={makeItems(3)} />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    // 1点目を包むボタンが2行分の高さを占める
    expect(images[0].closest("button")).toHaveClass("row-span-2");
  });

  it("4点は2×2グリッドで4要素", () => {
    render(<MediaGrid items={makeItems(4)} />);
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("5点以上でも表示は4要素まで", () => {
    render(<MediaGrid items={makeItems(7)} />);
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("1点目が常に先頭（代表位置）に配置される", () => {
    for (const count of [1, 2, 3, 4, 6]) {
      const { unmount } = render(<MediaGrid items={makeItems(count)} />);
      expect(screen.getAllByRole("img")[0]).toHaveAttribute("alt", "写真1");
      unmount();
    }
  });

  it("各要素に呼び出し元から渡した代替テキストが設定される（要件7.7）", () => {
    render(<MediaGrid items={makeItems(3)} />);
    expect(screen.getByAltText("写真1")).toBeInTheDocument();
    expect(screen.getByAltText("写真2")).toBeInTheDocument();
    expect(screen.getByAltText("写真3")).toBeInTheDocument();
  });
});

describe("MediaGrid 「+N」バッジ（Task2）", () => {
  it("4点以下ではバッジを表示しない", () => {
    for (const count of [1, 2, 3, 4]) {
      const { unmount } = render(<MediaGrid items={makeItems(count)} />);
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("5点なら「+2」（表示済み3点を除いた残数）", () => {
    render(<MediaGrid items={makeItems(5)} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("7点なら「+4」", () => {
    render(<MediaGrid items={makeItems(7)} />);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("バッジは4枠目（右下）に重なる", () => {
    render(<MediaGrid items={makeItems(6)} />);
    const badge = screen.getByText("+3");
    const images = screen.getAllByRole("img");
    expect(badge.closest("button")).toBe(images[3].closest("button"));
  });
});

describe("MediaGrid 動画（Task3）", () => {
  it("動画には再生アイコンを重ねる、写真には重ねない", () => {
    const { container } = render(<MediaGrid items={makeItems(2, { videoFirst: true })} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].querySelector("svg")).not.toBeNull();
    expect(buttons[1].querySelector("svg")).toBeNull();
  });

  it("動画が1点目なら代表位置に置かれる", () => {
    render(<MediaGrid items={makeItems(3, { videoFirst: true })} />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("alt", "写真1");
  });

  it("動画をタップするとインライン再生に切り替わる", () => {
    const { container } = render(<MediaGrid items={makeItems(1, { videoFirst: true })} />);
    expect(container.querySelector("video")).toBeNull();

    fireEvent.click(screen.getByRole("button"));

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "https://example.com/0.mp4");
  });

  it("写真をタップしても再生には切り替わらない", () => {
    const { container } = render(<MediaGrid items={makeItems(1)} />);
    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("video")).toBeNull();
  });
});

/**
 * 出典: docs/tasks/shared-ui/media-viewer/02-post-detail-integration.md 単体テスト
 * - 各枠のタップで正しい index が通知され、「+N」枠では 3 が通知される
 * - onSelect 無しでは動画タップがインライン再生のまま
 */
describe("MediaGrid onSelect（media-viewer Task2）", () => {
  it("各枠のタップで items 内の位置を通知する", () => {
    const onSelect = vi.fn();
    render(<MediaGrid items={makeItems(3)} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "写真2" }));
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "写真3" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("「+N」枠のタップは4点目（index 3）を通知する", () => {
    const onSelect = vi.fn();
    render(<MediaGrid items={makeItems(6)} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "残り3点を見る" }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("onSelect があれば動画タップでもインライン再生には切り替えず通知する", () => {
    const onSelect = vi.fn();
    const { container } = render(<MediaGrid items={makeItems(1, { videoFirst: true })} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("video")).toBeNull();
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
