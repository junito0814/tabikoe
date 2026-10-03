import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LAUNCH_GROUND } from "@/lib/theme/colors";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/10-launch-screen.md 単体テスト
 * 要件定義書 4.5.11「場面 1 の決着」・8 章 97
 *
 * 【初心者向け】この覆いの値打ちは「**外部ファイルを 1 つも待たずに描ける**」ことにある。
 * ふつうの作り方（別の CSS ファイル・画像ファイル・React の部品）に戻してしまうと、
 * 見た目は同じでも**白を消したい時間帯に間に合わなくなる**。
 * 見た目は機械で測れないので、ここで見るのは「その条件が崩れていないか」。
 */
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

/** 覆いの部品（LaunchCover）の中身だけを取り出す */
function launchCover(): string {
  const start = layout.indexOf("function LaunchCover()");
  expect(start, "LaunchCover が見つからない").toBeGreaterThan(-1);
  return layout.slice(start);
}

describe("帯と起動の地の色が揃っている", () => {
  it("theme-color が起動の地の色を指している（画面の地ではない）", () => {
    // ここが APP_BACKGROUND のままだと、マニフェストの青を白に塗り戻してしまう（2026-10-02 の事故）
    expect(layout).toContain("color: LAUNCH_GROUND.light");
    expect(layout).toContain("color: LAUNCH_GROUND.dark");
    expect(layout).not.toMatch(/color:\s*APP_BACKGROUND\./);
  });

  it("ライトはアイコンの地と同じ青", () => {
    expect(LAUNCH_GROUND.light).toBe("#2F7FD8");
  });

  it("ダークは globals.css のダークの --sky の最上部と同じ（新しい色を増やさない）", () => {
    // --sky のダークは linear-gradient(180deg, #0e1e3d 0%, ...) の形
    const darkSky = css.match(/--sky:\s*linear-gradient\(180deg,\s*(#[0-9a-fA-F]{6})/g);
    expect(darkSky, "--sky が 2 つ（ライト・ダーク）見つからない").toHaveLength(2);
    const dark = darkSky![1].match(/(#[0-9a-fA-F]{6})/)![1];
    expect(dark.toLowerCase()).toBe(LAUNCH_GROUND.dark.toLowerCase());
  });

  it("ライトとダークで別の値になっている", () => {
    expect(LAUNCH_GROUND.light).not.toBe(LAUNCH_GROUND.dark);
  });
});

describe("覆いが外部ファイルを待たない", () => {
  const cover = launchCover();

  it("JavaScript を使っていない（読み込みと実行を待たない）", () => {
    // Server Component のままであること。見るのはファイルの先頭の宣言だけ
    // （コメントに "use client" という文字が出てくるので、全文検索では誤検知する）
    expect(layout.trimStart().startsWith('"use client"')).toBe(false);
    expect(cover).not.toMatch(/\buseEffect\(/);
    expect(cover).not.toMatch(/\buseState\(/);
    expect(cover).not.toMatch(/onClick=/);
  });

  it("CSS をその場に書いている（外部 CSS の往復を待たない）", () => {
    expect(cover).toContain("<style>");
    expect(cover).toContain("#launch-cover{");
  });

  it("ロゴをその場に書いている（画像ファイルの往復を待たない）", () => {
    expect(cover).toContain("<svg viewBox=\"0 0 72 72\"");
    // 画像ファイルを参照していないこと
    expect(cover).not.toMatch(/<img|url\(|\.svg"|\.png"/);
  });

  it("body のいちばん上に置いている（他の要素の構築を待たない）", () => {
    const body = layout.indexOf("<body");
    const menu = layout.indexOf("<AppMenuBar");
    const launch = layout.indexOf("<LaunchCover />");
    expect(launch).toBeGreaterThan(body);
    expect(launch, "メニューバーより先に置くこと").toBeLessThan(menu);
  });
});

describe("覆いの振る舞い", () => {
  const cover = launchCover();

  it("静止して待ち、去るときだけ動く（保持 1000ms → フェード 250ms）", () => {
    /*
     * #663 で 300 → 600ms、#669 で 600 → 1000ms。どちらも実機で「短い」と分かって伸ばした。
     *
     * 【初心者向け】ここを厚くしてよい理由は、同じ日に**起動直後の白は消せないと確定した**こと
     * （5 つ試して 5 つとも効かず。要件 4.5.11「場面 1 の決着」）。白が消せない以上、
     * ロゴが出ている時間が**ブランドを見せられる唯一の場面**になる。
     * ただし中身が出るまで 2.5 秒以内（受入条件 97）なので、これ以上は伸ばさない。
     */
    expect(cover).toContain("animation:launch-leave 250ms ease-in 1000ms forwards");
  });

  it("去るときに軽く拡大する", () => {
    expect(cover).toMatch(/@keyframes launch-leave\{to\{[^}]*transform:scale\(1\.08\)/);
  });

  it("動きを減らす設定のときは拡大しない（フェードのみ）", () => {
    expect(cover).toContain("@media (prefers-reduced-motion:reduce)");
    expect(cover).toMatch(/@keyframes launch-fade\{to\{opacity:0;visibility:hidden\}\}/);
  });

  it("消えたあと場所を取らない", () => {
    expect(cover).toMatch(/@keyframes launch-leave\{to\{[^}]*visibility:hidden/);
  });

  it("触っても下の本物に届く（覆いは飾り）", () => {
    expect(cover).toContain("pointer-events:none");
  });

  it("読み上げの対象にしない", () => {
    expect(cover).toContain('aria-hidden="true"');
  });

  it("ダークでは地の色を変える", () => {
    expect(cover).toContain("@media (prefers-color-scheme:dark)");
  });
});

describe("効かなかった起動画像の扱い（#662 で 2026-10-03 に変更）", () => {
  it("宣言は外した（マニフェストからの自動生成を塞いでいる可能性があるため）", () => {
    // ~~残す~~ → 外す。詳しくは splash.test.ts と要件 4.5.11「場面 1 の決着」
    expect(layout).not.toMatch(/startupImage\s*:/);
  });

  it("動きを減らす設定でも、同じだけ待ってから消える", () => {
    // 見せる時間は演出ではなく「読む時間」なので、動きを減らす設定でも短くしない
    expect(launchCover()).toContain("animation:launch-fade 250ms linear 1000ms forwards");
  });
});
