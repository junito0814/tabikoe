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
 *
 * **2026-10-02（2 度目の修正のあと）: この仕組みは実機で働かないことが確定した。**
 * iPhone 17（402 × 874 @3）で `matchMedia()` に直接問い合わせて照合したところ、
 * **一致する宣言があり、HTML にも出ており、画像も HTTP 200 で配信されているのに出なかった**
 * （`apple-mobile-web-app-capable: yes` もあり、ホーム画面のアイコンも入れ直した）。
 * Apple が仕様をほとんど文書化していない古い仕組みで、iOS の版によって挙動が変わる。
 *
 * ~~**それでも宣言と画像は消していない。**~~ → **2026-10-03（#662）に宣言だけ外した。**
 * `theme-color` も効かず（4 つ目の空振り）、押した瞬間はやはり白だった。
 * iOS 16.4 以降は**宣言が 1 つも無いとき**にマニフェスト（`background_color`・アイコン・名前）から
 * 起動画面を自分で作るという挙動が報告されており、**効かない宣言がその道を塞いでいる可能性**がある。
 * 確証は無いので、これを最後の試みとする。
 *
 * **画像ファイルは消していない**（戻せるように）。このテストは
 * 「宣言が戻っていないか」と「戻すときの材料が揃っているか」を見る。
 */
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("iOS の起動画面（#662: 宣言を外した）", () => {
  it("起動画像の宣言を出していない", () => {
    // 効かないうえに、マニフェストからの自動生成を塞いでいる可能性があるため外した。
    // 「念のため戻しておく」で静かに復活すると、また同じ所で詰まる
    // コメントで経緯には触れているので、**指定そのもの**（`startupImage:` と画像の場所）で見る
    expect(layout).not.toMatch(/startupImage\s*:/);
    expect(layout).not.toContain("/splash/splash-");
  });

  it("画像ファイルは残してある（戻せるように）", () => {
    // 2026-10-02 までに作った 10 枚。実行時には読み込まれないので速度に影響しない
    for (const size of ["1320x2868", "1290x2796", "1284x2778", "1242x2688", "1206x2622", "1179x2556", "1170x2532", "1125x2436", "828x1792", "750x1334"]) {
      expect(existsSync(`public/splash/splash-${size}.png`), `splash-${size}.png が無い`).toBe(true);
    }
  });

  it("Apple の接頭辞付きの `apple-mobile-web-app-capable` は残している", () => {
    // 単独のアプリとして開くための指定。起動画像とは別の話なので外さない
    expect(layout).toContain('"apple-mobile-web-app-capable": "yes"');
  });

  it("マニフェストに起動画面の材料が揃っている（これが今回の頼み）", () => {
    // iOS に起動画面を作らせるには、地の色・アイコン・名前が要る
    const manifest = readFileSync("src/app/manifest.ts", "utf8");
    expect(manifest).toContain("background_color");
    expect(manifest).toContain("apple-icon.png");
    expect(manifest).toContain('name: "タビコエ"');
  });
});
