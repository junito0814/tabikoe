import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VideoTrimSheet } from "./VideoTrimSheet";
import { TRIM_FALLBACK_MESSAGE } from "@/lib/video/trim-plan";
import { TrimError, type LoadedVideo } from "@/lib/video/trim-video";
import { MAX_VIDEO_SIZE_BYTES } from "@/lib/video/limits";

/**
 * #861 / 要件 4.5.17（2026-10-10）: 切り取りの画面。
 *
 * 【初心者向け】ここで見張るのは**行き止まりを作らないこと**です。
 *   切り取りは端末によって動かないことがあります。黙って失敗すると、
 *   利用者は「動画が投稿できない」だけを知って、理由も次の手も分かりません。
 *   どこでつまずいても**案内に戻る**ことを確かめます。
 *
 * `mp4box` の実物は [trim-video.test.ts](src/lib/video/trim-video.test.ts) で
 * 本物の MP4 を使って試しています。ここでは差し替え口から入れた偽物で**画面の筋道**だけを見ます。
 */
const file = new File([new Uint8Array(1000)], "long.mp4", { type: "video/mp4" });

/** 40 秒・2 秒ごとにキーフレーム */
const loaded = {
  durationSeconds: 40,
  keyframeTimes: Array.from({ length: 20 }, (_, i) => i * 2),
  width: 720,
  height: 1280,
  source: {} as LoadedVideo["source"],
} satisfies LoadedVideo;

function setup(overrides: Partial<React.ComponentProps<typeof VideoTrimSheet>> = {}) {
  const onTrimmed = vi.fn();
  const onGiveUp = vi.fn();
  const onClose = vi.fn();
  const trimmed = new File([new Uint8Array(2000)], "trimmed.mp4", { type: "video/mp4" });
  render(
    <VideoTrimSheet
      file={file}
      durationSeconds={40}
      onTrimmed={onTrimmed}
      onGiveUp={onGiveUp}
      onClose={onClose}
      load={async () => loaded}
      trim={async () => trimmed}
      measure={async () => 29.9}
      {...overrides}
    />
  );
  return { onTrimmed, onGiveUp, onClose, trimmed };
}

/** #928: つまみは 2 つになった（始まり・終わり） */
const startHandle = () => screen.getByRole("slider", { name: "切り取りの始まり" });
const endHandle = () => screen.getByRole("slider", { name: "切り取りの終わり" });
const ready = () => screen.findByRole("slider", { name: "切り取りの始まり" });

describe("切り取りの画面（要件 4.5.17）", () => {
  it("選んでいる範囲と**長さ**を数字で出す（#928）", async () => {
    setup();
    await ready();
    expect(screen.getByText("0:00 〜 0:30")).toBeTruthy();
    expect(screen.getByText("30 秒")).toBeTruthy();
    expect(screen.getByText(/両端のつまみで長さを決められます/)).toBeTruthy();
  });

  it("始まりのつまみを動かすと、終わりは動かない（#928: 長さが変わる）", async () => {
    setup();
    await ready();
    // 指で動かせない人のために矢印キーでも動く
    fireEvent.keyDown(startHandle(), { key: "ArrowRight" });
    expect(await screen.findByText("0:02 〜 0:30")).toBeTruthy();
    expect(screen.getByText("28 秒")).toBeTruthy();
  });

  it("終わりのつまみを動かすと、長さが縮む（#928）", async () => {
    setup();
    await ready();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(endHandle(), { key: "ArrowLeft" });
    expect(await screen.findByText("0:00 〜 0:25")).toBeTruthy();
    expect(screen.getByText("25 秒")).toBeTruthy();
  });

  it("**長さが 1 秒より短くならない**（再生できないものを作らない）", async () => {
    setup();
    await ready();
    for (let i = 0; i < 60; i++) fireEvent.keyDown(endHandle(), { key: "ArrowLeft" });
    expect(await screen.findByText("1 秒")).toBeTruthy();
    expect(screen.getByText("0:00 〜 0:01")).toBeTruthy();
  });

  it("**長さが 30 秒を超えない**（超えるとサーバーが断る）", async () => {
    setup();
    await ready();
    for (let i = 0; i < 60; i++) fireEvent.keyDown(endHandle(), { key: "ArrowRight" });
    expect(await screen.findByText("30 秒")).toBeTruthy();
    expect(screen.getByText("0:00 〜 0:30")).toBeTruthy();
  });

  it("始まりは動画の終わり際で止まる（40 秒の動画）", async () => {
    setup();
    await ready();
    for (let i = 0; i < 40; i++) fireEvent.keyDown(startHandle(), { key: "ArrowRight" });
    // 終わり（0:30）の 1 秒前まで。キーフレームは 2 秒ごとなので 0:28
    expect(await screen.findByText("0:28 〜 0:30")).toBeTruthy();
  });

  it("読み上げでも**両端と長さ**が分かる（#928）", async () => {
    setup();
    await ready();
    expect(startHandle().getAttribute("aria-valuetext")).toBe("0:00 から 0:30 まで、30 秒");
    expect(endHandle().getAttribute("aria-valuetext")).toBe("0:00 から 0:30 まで、30 秒");
  });

  it("コマ画像の場所を先に空けておく（絵は後から埋まる。#928）", async () => {
    setup();
    await ready();
    // 絵が出来ていないところは「待ち」の印が付いている（灰色のまま帯は動かせる）
    expect(document.querySelectorAll("[data-frame]").length).toBeGreaterThan(0);
  });

  it("「この範囲にする」で切り取り、できたファイルを渡す", async () => {
    const trim: React.ComponentProps<typeof VideoTrimSheet>["trim"] = vi.fn(async () => new File([new Uint8Array(2000)], "trimmed.mp4", { type: "video/mp4" }));
    const { onTrimmed } = setup({ trim });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(onTrimmed).toHaveBeenCalledTimes(1));
    // 切り取った範囲が渡っている
    expect(vi.mocked(trim!).mock.calls[0][1]).toEqual({ startSeconds: 0, endSeconds: 30 });
  });

  it("切り取りの最中は進み具合を出し、中断できる（要件 4.5.11）", async () => {
    let cancelled = false;
    const trim = vi.fn(async (_loaded, _range, options) => {
      options?.onProgress?.(0.4);
      // 「やめる」が押されるまで待ってから、中断として投げる
      await waitFor(() => expect(cancelled).toBe(true));
      throw new TrimError("cancelled");
    }) as unknown as React.ComponentProps<typeof VideoTrimSheet>["trim"];
    const { onTrimmed, onGiveUp } = setup({ trim });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));

    expect(await screen.findByText("切り取っています…")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "切り取りの進み具合" }).getAttribute("aria-valuenow")).toBe("40");

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    cancelled = true;
    // 元の画面に戻るだけ。失敗扱いにはしない
    expect(await screen.findByRole("button", { name: "この範囲にする" })).toBeTruthy();
    expect(onTrimmed).not.toHaveBeenCalled();
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it("読み込めなかったら、要件 4.5.17 の案内に戻る", async () => {
    const { onGiveUp } = setup({
      load: async () => {
        throw new TrimError("unsupported");
      },
    });
    await waitFor(() => expect(onGiveUp).toHaveBeenCalledWith(TRIM_FALLBACK_MESSAGE));
  });

  it("切り取りが失敗したら、案内に戻る", async () => {
    const { onGiveUp } = setup({
      trim: async () => {
        throw new TrimError("failed");
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(onGiveUp).toHaveBeenCalledWith(TRIM_FALLBACK_MESSAGE));
  });

  it("**できあがりの長さがおかしければ、添付しない**（安全網）", async () => {
    // 切り取れたつもりで 30 秒を超えている ── サーバーに断られる前にここで気づく
    const { onTrimmed, onGiveUp } = setup({ measure: async () => 31 });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(onGiveUp).toHaveBeenCalledWith(TRIM_FALLBACK_MESSAGE));
    expect(onTrimmed).not.toHaveBeenCalled();
  });

  it("長さを読めなかったときも添付しない", async () => {
    const { onTrimmed, onGiveUp } = setup({ measure: async () => null });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(onGiveUp).toHaveBeenCalled());
    expect(onTrimmed).not.toHaveBeenCalled();
  });

  it("切り取っても 50MB を超えたら、別の文で断る（短くしても直らないため）", async () => {
    const big = new File([new Uint8Array(1000)], "trimmed.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: MAX_VIDEO_SIZE_BYTES + 1 });
    const { onGiveUp } = setup({ trim: async () => big });
    fireEvent.click(await screen.findByRole("button", { name: "この範囲にする" }));
    await waitFor(() => expect(onGiveUp).toHaveBeenCalled());
    const message = onGiveUp.mock.calls[0][0] as string;
    expect(message).toContain("50MB");
    expect(message).not.toBe(TRIM_FALLBACK_MESSAGE);
  });

  it("大きすぎる動画は、読み込む前に断る（ブラウザが落ちるのを避ける）", async () => {
    const huge = new File([new Uint8Array(10)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(huge, "size", { value: 400 * 1024 * 1024 });
    const load = vi.fn(async () => loaded);
    const { onGiveUp } = setup({ file: huge, load });
    await waitFor(() => expect(onGiveUp).toHaveBeenCalled());
    // 読み込みに入っていない
    expect(load).not.toHaveBeenCalled();
  });

  it("「×」で閉じると、何も添付しない", async () => {
    const { onClose, onTrimmed } = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "閉じる" }))[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onTrimmed).not.toHaveBeenCalled();
  });
});
