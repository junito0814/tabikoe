/**
 * #927 / 要件 4.5.1・決定事項 90（2026-10-11）: 選んだ写真・動画をタップして大きく見る。
 *
 * 【初心者向け】ここで見るのは**投稿画面とモーダルの結び目**だけです。
 *   モーダルそのもの（左右の送り・× で閉じる）は
 *   [MediaModal.test.tsx](src/components/media/MediaModal.test.tsx) で確かめています。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/map/GoogleMap", () => ({ GoogleMap: () => <div data-testid="google-map" /> }));

/**
 * 動画の長さは `<video>` から読む。jsdom では読めないので、読めた体にする。
 * 切り取ったあと（`trimmed.mp4`）は 17.5 秒 ── 18 秒の動画を丸ごと選んだときの
 * 出来上がりの検査（`checkTrimmedOutput`）を通る長さにする。
 */
const duration = { seconds: 18 as number | null };
vi.mock("@/lib/video/read-duration", () => ({
  DURATION_READ_TIMEOUT_MS: 5000,
  readVideoDuration: vi.fn(async (file: File) => (file.name === "trimmed.mp4" ? 17.5 : duration.seconds)),
}));

const trimmed = new File([new Uint8Array(2000)], "trimmed.mp4", { type: "video/mp4" });
const canTrim = { value: true };
vi.mock("@/lib/video/trim-video", () => ({
  canTrimVideo: () => canTrim.value,
  TrimError: class TrimError extends Error {},
  loadVideoForTrim: vi.fn(async () => ({ durationSeconds: 18, keyframeTimes: [0, 2, 4, 6], width: 720, height: 1280, source: {} })),
  trimVideo: vi.fn(async () => trimmed),
}));

import { PostComposeScreen, type ComposeApi } from "./PostComposeScreen";
import { buildComposeInitialState } from "@/lib/posts/compose-initial-state";

const api: ComposeApi = {
  upload: vi.fn(async () => new Response("{}", { status: 201 })),
  create: vi.fn(async () => new Response("{}", { status: 201 })),
  update: vi.fn(async () => new Response("{}")),
  attachMedia: vi.fn(async () => new Response("{}", { status: 201 })),
  deletePhoto: vi.fn(async () => new Response("{}")),
  resolveSpot: vi.fn(async () => null),
};

const initial = buildComposeInitialState({ lat: "35.6", lng: "139.7", from: "current" });
const video = (name = "IMG_0002.mp4") => new File([new Uint8Array(1000)], name, { type: "video/mp4" });
const photo = (name = "IMG_0001.jpg") => new File([new Uint8Array(10)], name, { type: "image/jpeg" });

/** 写真・動画を選ぶ。`existing` を渡すと「編集中の投稿」になる */
async function pick(files: File[], existing?: React.ComponentProps<typeof PostComposeScreen>["existing"]) {
  render(<PostComposeScreen initial={initial} api={api} videoUploadDisabled={false} existing={existing ?? null} />);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("写真・動画を選択") as HTMLInputElement, { target: { files } });
  });
}

const openThumbnail = (alt: string) => fireEvent.click(screen.getByRole("button", { name: `${alt}を大きく見る` }));
const modal = () => screen.queryByRole("dialog");

beforeEach(() => {
  duration.seconds = 18;
  canTrim.value = true;
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("タップして大きく見る", () => {
  it("写真をタップすると開く", async () => {
    await pick([photo()]);
    expect(modal()).toBeNull();
    openThumbnail("IMG_0001.jpg");
    expect(modal()).not.toBeNull();
  });

  it("**押せる部品になっている**（キーボードでも辿れるように）", async () => {
    await pick([photo()]);
    expect(screen.getByRole("button", { name: "IMG_0001.jpgを大きく見る" }).tagName).toBe("BUTTON");
  });

  it("すでに付いている写真と新しく選んだものが 1 つの並びで出る（要件 4.5.1）", async () => {
    await pick([photo()], {
      postId: "p1",
      status: "draft",
      values: { tripTitle: "", category: "", visitDate: "", duration: "", cost: "", rating: 0, comment: "", visibility: "public" },
      spot: null,
      position: null,
      photos: [{ id: "ph1", url: "https://example.test/ph1.jpg", mediaType: "photo" }],
    });
    openThumbnail("投稿済みの写真");
    // 1 / 2 ── すでに付いている 1 枚と、新しく選んだ 1 枚が同じ並びにいる
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("**「外す」はモーダルに置かない**（外すのはサムネイルの × の 1 か所。決定事項 80）", async () => {
    await pick([photo()]);
    openThumbnail("IMG_0001.jpg");
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("[aria-label$='を外す']")).toBeNull();
  });

  it("外したものを大きく見たままにしない", async () => {
    await pick([photo()]);
    openThumbnail("IMG_0001.jpg");
    fireEvent.click(screen.getByRole("button", { name: "IMG_0001.jpgを外す" }));
    expect(modal()).toBeNull();
  });
});

describe("動画のときの「切り取る」", () => {
  it("いまの長さを添えて出す（要件 4.5.17）", async () => {
    await pick([video()]);
    openThumbnail("IMG_0002.mp4");
    expect(screen.getByRole("button", { name: "切り取る（いまは 0:18）" })).toBeTruthy();
  });

  it("**写真には出さない**", async () => {
    await pick([photo()]);
    openThumbnail("IMG_0001.jpg");
    expect(screen.queryByRole("button", { name: /^切り取る/ })).toBeNull();
  });

  it("端末が切り取れないときは出さない（押しても何もできないボタンを出さない）", async () => {
    canTrim.value = false;
    await pick([video()]);
    openThumbnail("IMG_0002.mp4");
    expect(screen.queryByRole("button", { name: /^切り取る/ })).toBeNull();
  });

  it("押すと切り取りのシートが開く（モーダルは閉じる）", async () => {
    await pick([video()]);
    openThumbnail("IMG_0002.mp4");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "切り取る（いまは 0:18）" }));
    });
    expect(await screen.findByText("切り取る範囲を選ぶ")).toBeTruthy();
  });

  it("**切り取ったら差し替える**（足さない ── 同じ動画が 2 本並ばないように）", async () => {
    await pick([video()]);
    openThumbnail("IMG_0002.mp4");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "切り取る（いまは 0:18）" }));
    });
    await screen.findByText(/を切り取ります/);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "この範囲にする" }));
    });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /を外す$/ })).toHaveLength(1));
    expect(screen.getByRole("button", { name: "trimmed.mp4を外す" })).toBeTruthy();
  });

  it("切り取り直したあとの長さは、切り取った結果の長さになる", async () => {
    await pick([video()]);
    openThumbnail("IMG_0002.mp4");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "切り取る（いまは 0:18）" }));
    });
    await screen.findByText(/を切り取ります/);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "この範囲にする" }));
    });
    await screen.findByRole("button", { name: "trimmed.mp4を外す" });
    openThumbnail("trimmed.mp4");
    expect(screen.getByRole("button", { name: "切り取る（いまは 0:17）" })).toBeTruthy();
  });
});
