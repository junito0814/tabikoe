/**
 * #861 / 要件 4.5.17（2026-10-10）: 長い動画を選んだときに、断らずに切り取りへ送る。
 *
 * 【初心者向け】この結び目（投稿画面 → 切り取りのシート）だけを見ます。
 *   切り取りそのものは [VideoTrimSheet.test.tsx](src/components/posts/VideoTrimSheet.test.tsx)、
 *   MP4 の組み直しは [trim-video.test.ts](src/lib/video/trim-video.test.ts) で確かめています。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/map/GoogleMap", () => ({ GoogleMap: () => <div data-testid="google-map" /> }));

/**
 * 動画の長さは `<video>` から読むので、jsdom では読めない。読めた体にする。
 * 切り取ったあとのファイル（`trimmed.mp4`）は 29.9 秒 ── 出来上がりの検査を通る長さにする。
 */
const duration = { seconds: 72 as number | null };
vi.mock("@/lib/video/read-duration", () => ({
  DURATION_READ_TIMEOUT_MS: 5000,
  readVideoDuration: vi.fn(async (file: File) => (file.name === "trimmed.mp4" ? 29.9 : duration.seconds)),
}));

/** mp4box の実物は動かさない（本物は trim-video.test.ts で試している） */
const trimmed = new File([new Uint8Array(2000)], "trimmed.mp4", { type: "video/mp4" });
const canTrim = { value: true };
vi.mock("@/lib/video/trim-video", () => ({
  canTrimVideo: () => canTrim.value,
  TrimError: class TrimError extends Error {},
  loadVideoForTrim: vi.fn(async () => ({ durationSeconds: 72, keyframeTimes: [0, 2, 4, 6], width: 720, height: 1280, source: {} })),
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

/** 72 秒の動画を選ぶ */
async function pickLongVideo() {
  render(<PostComposeScreen initial={initial} api={api} videoUploadDisabled={false} />);
  const input = screen.getByLabelText("写真を選択") as HTMLInputElement;
  const video = new File([new Uint8Array(1000)], "long.mp4", { type: "video/mp4" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [video] } });
  });
}

beforeEach(() => {
  duration.seconds = 72;
  canTrim.value = true;
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("長い動画を選んだとき（要件 4.5.17）", () => {
  it("断らずに切り取りのシートを出す", async () => {
    await pickLongVideo();
    expect(await screen.findByText("切り取る範囲を選ぶ")).toBeTruthy();
    // 「選び直してください」で突き返していない
    expect(screen.queryByText(/選び直してください/)).toBeNull();
  });

  it("切り取れたら、そのファイルを添付する", async () => {
    await pickLongVideo();
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(screen.queryByText("切り取る範囲を選ぶ")).toBeNull());
    // 選んだものが 1 つ入る（サムネイルの「外す」ボタンで数える）
    expect(await screen.findByRole("button", { name: /を外す$/ })).toBeTruthy();
  });

  it("切り取れない端末では、長さを添えて断る（シートは出さない）", async () => {
    canTrim.value = false;
    await pickLongVideo();
    expect(await screen.findByText(/この動画は 1:12 です/)).toBeTruthy();
    expect(screen.queryByText("切り取る範囲を選ぶ")).toBeNull();
  });

  it("切り取りがうまくいかなかったら、投稿画面に理由を出して受け付けない", async () => {
    // 切り取れたつもりで 30 秒を超えている（出来上がりの検査がここで止める）
    const broken = new File([new Uint8Array(2000)], "broken.mp4", { type: "video/mp4" });
    const trimVideo = vi.mocked((await import("@/lib/video/trim-video")).trimVideo);
    trimVideo.mockResolvedValueOnce(broken);
    await pickLongVideo();
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));

    expect(await screen.findByText(/この端末では動画を切り取れませんでした/)).toBeTruthy();
    // 添付はされない
    expect(screen.queryByRole("button", { name: /を外す$/ })).toBeNull();
  });

  it("30 秒以内の動画では、シートを出さずにそのまま添付する", async () => {
    duration.seconds = 20;
    await pickLongVideo();
    expect(screen.queryByText("切り取る範囲を選ぶ")).toBeNull();
    expect(await screen.findByRole("button", { name: /を外す$/ })).toBeTruthy();
  });
});
