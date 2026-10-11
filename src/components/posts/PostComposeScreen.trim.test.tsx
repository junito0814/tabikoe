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

/** 動画と写真をまとめて選ぶ（既定は 72 秒の動画 1 本） */
async function pick(files: File[] = [new File([new Uint8Array(1000)], "long.mp4", { type: "video/mp4" })]) {
  render(<PostComposeScreen initial={initial} api={api} videoUploadDisabled={false} />);
  // 動画を受け付けているときは言葉が変わる（#861）
  const input = screen.getByLabelText("写真・動画を選択") as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

const pickLongVideo = () => pick();
const longVideo = (name: string) => new File([new Uint8Array(1000)], name, { type: "video/mp4" });
const photo = (name: string) => new File([new Uint8Array(10)], name, { type: "image/jpeg" });
const outside = () => screen.getAllByRole("button", { name: /を外す$/ });

/**
 * 「この範囲にする」が押せるようになるまで待ってから押す。
 *
 * 【初心者向け】見出しは**読み込み中にも出ています**。見出しを見て押すと、
 * まだ押せないボタンを押して何も起きないことがあります（全体実行のときだけ落ちました）。
 * 範囲の数字は読み込みが済んでから出るので、そちらを待ちます。
 */
async function applyRange() {
  // #928: つまみが出たら、帯は使える（文字は「0:00 〜 0:30」と長さに分かれた）
  await screen.findByRole("slider", { name: "切り取りの始まり" });
  fireEvent.click(screen.getByRole("button", { name: "この範囲にする" }));
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
    await applyRange();
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
    await applyRange();

    expect(await screen.findByText(/この端末では動画を切り取れませんでした/)).toBeTruthy();
    // 添付はされない
    expect(screen.queryByRole("button", { name: /を外す$/ })).toBeNull();
  });

  it("長い動画が 2 本あっても、どちらも取りこぼさない（1 本ずつ切り取る）", async () => {
    await pick([longVideo("a.mp4"), longVideo("b.mp4")]);

    // 1 本目。残りがあることを見出しで伝える
    expect(await screen.findByText("切り取る範囲を選ぶ（あと 2 本）")).toBeTruthy();
    await applyRange();

    // 続けて 2 本目が出る（閉じて終わりにしない）
    expect(await screen.findByText("切り取る範囲を選ぶ")).toBeTruthy();
    await applyRange();

    await waitFor(() => expect(screen.queryByText(/切り取る範囲を選ぶ/)).toBeNull());
    expect(outside()).toHaveLength(2);
  });

  it("長い動画の後ろに選んだ写真も消えない", async () => {
    await pick([longVideo("a.mp4"), photo("b.jpg")]);
    // 写真は切り取りを待たずに先に入る
    expect(outside()).toHaveLength(1);
    await applyRange();
    await waitFor(() => expect(outside()).toHaveLength(2));
  });

  it("切り取りをやめたら、残りを取り込まないことを言う（黙って消さない）", async () => {
    await pick([longVideo("a.mp4"), longVideo("b.mp4")]);
    await screen.findByText("切り取る範囲を選ぶ（あと 2 本）");
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);

    expect(await screen.findByText(/残り 1 本の動画は取り込んでいません/)).toBeTruthy();
    expect(screen.queryByText(/切り取る範囲を選ぶ/)).toBeNull();
  });

  it("30 秒以内の動画では、シートを出さずにそのまま添付する", async () => {
    duration.seconds = 20;
    await pickLongVideo();
    expect(screen.queryByText("切り取る範囲を選ぶ")).toBeNull();
    expect(await screen.findByRole("button", { name: /を外す$/ })).toBeTruthy();
  });
});
