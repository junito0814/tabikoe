import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * 出典: #623（ホーム画面から開いたとき起動直後が白いまま）
 * 要件定義書 4.5.11 の場面 1・8 章 85
 *
 * 【初心者向け】iOS はマニフェストの色を起動画面に使わない。画面の大きさが**ぴったり一致する**
 * 画像を渡したときだけ、それを出す。一致しなければ白のまま。だから「宣言した画像が実在するか」と
 * 「大きさの指定と画像の名前が食い違っていないか」を機械で確かめる。
 */
const layout = readFileSync("src/app/layout.tsx", "utf8");

/** layout.tsx から { url, media } の組を取り出す */
function startupImages(): { url: string; media: string }[] {
  return [...layout.matchAll(/\{ url: "(\/splash\/[^"]+)", media: "([^"]+)" \}/g)].map((m) => ({ url: m[1], media: m[2] }));
}

describe("iOS の起動画面", () => {
  const images = startupImages();

  it("8 枚を宣言している（いまの iPhone をほぼ網羅する）", () => {
    expect(images).toHaveLength(8);
  });

  it("宣言した画像がすべて実在する", () => {
    for (const { url } of images) {
      expect(existsSync(`public${url}`), `${url} が無い`).toBe(true);
    }
  });

  it("画像の名前の大きさと、指定した画面の大きさ × 解像度が一致する", () => {
    for (const { url, media } of images) {
      const file = url.match(/splash-(\d+)x(\d+)\.png$/);
      expect(file, `${url} の名前が想定と違う`).toBeTruthy();
      const w = Number(file![1]);
      const h = Number(file![2]);
      const dw = Number(media.match(/device-width:\s*(\d+)px/)![1]);
      const dh = Number(media.match(/device-height:\s*(\d+)px/)![1]);
      const ratio = Number(media.match(/-webkit-device-pixel-ratio:\s*(\d+)/)![1]);
      expect(dw * ratio, `${url} の幅が合わない`).toBe(w);
      expect(dh * ratio, `${url} の高さが合わない`).toBe(h);
    }
  });

  it("縦向きだけを指している（このアプリは縦が前提）", () => {
    for (const { media } of images) {
      expect(media).toContain("orientation: portrait");
    }
  });

  it("同じ条件の画像を 2 つ宣言していない（どちらが使われるか決まらなくなる）", () => {
    const keys = images.map((i) => i.media);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("マニフェストの background_color は残してある（Android の起動画面に効く）", () => {
    const manifest = readFileSync("src/app/manifest.ts", "utf8");
    expect(manifest).toContain("background_color");
  });
});
