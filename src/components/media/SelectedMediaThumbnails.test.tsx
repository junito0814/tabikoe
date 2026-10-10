/**
 * 出典: docs/tasks/shared-ui/media-layout-v3/02-form-thumbnails.md（単体テスト）
 * 「選択した 3 点がサムネイルで並び、× で 1 点外れること」「動画に ▶ 印が付くこと」
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelectedMediaThumbnails, type SelectedMedia } from "./SelectedMediaThumbnails";

const items: SelectedMedia[] = [
  { key: "a", url: "blob:a", mediaType: "photo", alt: "写真1" },
  { key: "b", url: "blob:b", mediaType: "video", alt: "動画2" },
  { key: "c", url: "blob:c", mediaType: "photo", alt: "写真3" },
];

/** 直前に描いたものの入れ物（`render` の戻り値を使い回す代わり） */
const container = () => document.body;

describe("SelectedMediaThumbnails", () => {
  it("3 点がサムネイルで並び、× でその 1 点を外す", () => {
    const onRemove = vi.fn();
    render(<SelectedMediaThumbnails items={items} onRemove={onRemove} />);
    // 写真は <img>、動画は <video>（#923。<img> は動画を描けず、絵が出ないまま読み込みだけ走っていた）
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(container().querySelectorAll("video")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "動画2を外す" }));
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("動画のサムネイルは、先頭の絵だけを読む（全部は読み込まない）", () => {
    render(<SelectedMediaThumbnails items={items} onRemove={() => {}} />);
    const video = container().querySelector("video")!;
    // preload="metadata" ＝ ブラウザは先頭のごく一部だけ読む
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("src")).toBe("blob:b");
  });
  it("動画には ▶ 印が付く", () => {
    const { container } = render(<SelectedMediaThumbnails items={items} onRemove={() => {}} />);
    expect(container.querySelectorAll("[data-video-overlay]")).toHaveLength(1);
  });
  it("onAdd があれば「＋」を出す", () => {
    const onAdd = vi.fn();
    render(<SelectedMediaThumbnails items={[]} onRemove={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
