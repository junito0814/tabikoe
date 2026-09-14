import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePostMediaViewer } from "./use-post-media-viewer";
import type { MediaItem } from "./MediaGrid";

/**
 * 出典: docs/tasks/shared-ui/media-viewer/04-post-card-integration.md 単体テスト
 * - サムネイルのタップで投稿の全メディアを取得し、1点目からモーダルを開くこと
 * - 取得失敗時はエラーを表示すること
 */
const media: MediaItem[] = [
  { id: "a", mediaType: "photo", thumbnailUrl: "https://example.com/a.jpg", alt: "写真 1" },
  { id: "b", mediaType: "photo", thumbnailUrl: "https://example.com/b.jpg", alt: "写真 2" },
];

function Harness({ fetchPostMedia }: { fetchPostMedia: (postId: string) => Promise<MediaItem[]> }) {
  const viewer = usePostMediaViewer(fetchPostMedia);
  return (
    <div>
      <button type="button" onClick={() => void viewer.openPost("post-1")}>
        開く
      </button>
      {viewer.errorMessage && <p>{viewer.errorMessage}</p>}
      {viewer.viewer}
    </div>
  );
}

describe("usePostMediaViewer", () => {
  it("投稿IDで全メディアを取得し、1点目からモーダルを開く", async () => {
    const fetchPostMedia = vi.fn(async () => media);
    render(<Harness fetchPostMedia={fetchPostMedia} />);

    fireEvent.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("1 / 2");
    expect(fetchPostMedia).toHaveBeenCalledWith("post-1");
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("2 / 2");
  });

  it("取得に失敗したらエラーを表示し、モーダルは開かない", async () => {
    render(<Harness fetchPostMedia={vi.fn(async () => { throw new Error("down"); })} />);
    fireEvent.click(screen.getByRole("button", { name: "開く" }));
    await waitFor(() => expect(screen.getByText("写真・動画を読み込めませんでした")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
