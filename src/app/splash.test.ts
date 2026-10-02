import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * 出典: #623（ホーム画面から開いたとき起動直後が白いまま）
 * 要件定義書 4.5.11 の場面 1・8 章 85
 *
 * 【初心者向け】iOS はマニフェストの色を起動画面に使わない。画面の大きさが**ぴったり一致する**
 * 画像を渡したときだけ、それを出す。一致しなければ白のまま。だから「宣言した画像が実在するか」と
 * 「大きさの指定と画像の名前が食い違っていないか」を機械で確かめる。
 *
 * 2026-10-02 に 2 件足した。1 度目の修正では実機が白のままで、原因が 2 つあったため。
 *   - 端末の大きさの取りこぼし（16 Pro・16 Pro Max）→ `media` の無い受け皿を見る
 *   - `apple-mobile-web-app-capable` が出ていなかった → その meta を見る
 */
const layout = readFileSync("src/app/layout.tsx", "utf8");

/** layout.tsx の一覧から「大きさを指定した」宣言を取り出す */
function sizedImages(): { url: string; media: string }[] {
  return [...layout.matchAll(/\{ url: "(\/splash\/[^"]+)", media: "([^"]+)" \}/g)].map((m) => ({ url: m[1], media: m[2] }));
}

/** 一覧から「`media` の無い受け皿」を取り出す（裸の文字列で書いてあるもの） */
function fallbackImages(): string[] {
  const list = layout.match(/const APPLE_STARTUP_IMAGES = \[([\s\S]*?)\n\];/);
  if (!list) return [];
  return [...list[1].matchAll(/^\s*"(\/splash\/[^"]+)",\s*$/gm)].map((m) => m[1]);
}

describe("iOS の起動画面", () => {
  const images = sizedImages();
  const fallbacks = fallbackImages();

  it("大きさを指定した宣言が 10 枚ある（いまの iPhone をほぼ網羅する）", () => {
    expect(images).toHaveLength(10);
  });

  it("宣言した画像がすべて実在する", () => {
    for (const url of [...images.map((i) => i.url), ...fallbacks]) {
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

  it("いまの iPhone の大きさを取りこぼしていない", () => {
    // 一覧に無いと、その端末では必ず白になる（16 Pro・16 Pro Max がこれで漏れていた）
    const covered = new Set(
      images.map((i) => {
        const dw = i.media.match(/device-width:\s*(\d+)px/)![1];
        const dh = i.media.match(/device-height:\s*(\d+)px/)![1];
        const ratio = i.media.match(/-webkit-device-pixel-ratio:\s*(\d+)/)![1];
        return `${dw}x${dh}@${ratio}`;
      }),
    );
    const mustCover: [string, string][] = [
      ["440x956@3", "16 Pro Max"],
      ["430x932@3", "14 Pro Max・15 Pro Max・15 Plus"],
      ["402x874@3", "16 Pro"],
      ["393x852@3", "14 Pro・15・15 Pro・16"],
      ["390x844@3", "12・13・14"],
      ["375x812@3", "X・XS・11 Pro・12 mini・13 mini"],
      ["375x667@2", "SE（第 2・第 3 世代）・8"],
    ];
    for (const [key, label] of mustCover) {
      expect(covered.has(key), `${label}（${key}）の宣言が無い`).toBe(true);
    }
  });

  it("`media` の無い受け皿が 1 枚だけあり、一覧の最後に置いてある", () => {
    // どの `media` にも一致しない端末（これから出る iPhone など）で白にならないための 1 枚。
    // 2 枚あるとどちらが使われるか決まらないので 1 枚に限る
    expect(fallbacks).toHaveLength(1);
    const list = layout.match(/const APPLE_STARTUP_IMAGES = \[([\s\S]*?)\n\];/)![1];
    const lastSized = list.lastIndexOf('{ url: "/splash/');
    const fallbackAt = list.lastIndexOf(`"${fallbacks[0]}",`);
    expect(fallbackAt).toBeGreaterThan(lastSized);
  });

  it("Apple の接頭辞付きの `apple-mobile-web-app-capable` を出している", () => {
    // Next 16 は接頭辞なしの `mobile-web-app-capable` しか出さない。
    // 起動画面はこの接頭辞付きと組で使う決まりなので、自分で足す必要がある
    expect(layout).toContain('"apple-mobile-web-app-capable": "yes"');
  });

  it("マニフェストの background_color は残してある（Android の起動画面に効く）", () => {
    const manifest = readFileSync("src/app/manifest.ts", "utf8");
    expect(manifest).toContain("background_color");
  });
});
