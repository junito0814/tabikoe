import { afterEach, describe, expect, it } from "vitest";
import { postCardDescription, shareCardTitle, spotCardDescription } from "./share-card";
import { siteUrl } from "./site-url";

/**
 * 出典: Issue #952、要件定義書 4.5.18「OG（リンクカード）」
 *
 * 【初心者向け】DB を引く部分（`spotShareCard` / `postShareCard`）は実際に動かして確かめ、
 * ここでは**文言と住所の組み立て**だけを見ます。文言は「貼った先で読まれる唯一の説明」なので、
 * 形が崩れていないかをここで押さえておきます。
 */
describe("カードの文言（#952）", () => {
  it("題名はどちらの画面も「〈スポット名〉｜タビコエ」（区切りは全角）", () => {
    expect(shareCardTitle("浅草寺")).toBe("浅草寺｜タビコエ");
  });

  it("スポットの説明は「行った人の投稿 N 件　★x.x」", () => {
    expect(spotCardDescription(12, 4.25)).toBe("行った人の投稿 12 件　★4.3");
    expect(spotCardDescription(1, 5)).toBe("行った人の投稿 1 件　★5.0");
  });

  it("評価がまだ無いスポットは、件数だけ出す（★なしと書かない）", () => {
    expect(spotCardDescription(3, null)).toBe("行った人の投稿 3 件");
  });

  it("投稿の説明は感想の冒頭 1 行", () => {
    expect(postCardDescription("桜がきれいだった\n次は夜に来たい")).toBe("桜がきれいだった");
  });

  it("長い感想は切って、切った印を付ける（カードは 2 行ほどで切られるため）", () => {
    const description = postCardDescription("あ".repeat(200));
    expect(description).toHaveLength(91);
    expect(description.endsWith("…")).toBe(true);
  });

  it("感想が無い投稿でも、空にはしない", () => {
    expect(postCardDescription(null)).toBe("行った人の投稿");
    expect(postCardDescription("   ")).toBe("行った人の投稿");
  });
});

/**
 * `og:url` は**絶対 URL**でなければならない（貼られた側のサーバーが読むため）。
 * 設定が無くても落ちないこと（手元で動かすとき）を押さえる。
 */
describe("siteUrl（#952）", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("自分で決めた住所がいちばん強い", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tabikoe.example";
    expect(siteUrl().toString()).toBe("https://tabikoe.example/");
  });

  it("Vercel の本番 → プレビュー の順に使う", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tabikoe.vercel.app";
    process.env.VERCEL_URL = "preview.vercel.app";
    expect(siteUrl().host).toBe("tabikoe.vercel.app");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl().host).toBe("preview.vercel.app");
  });

  it("どれも無ければ手元（localhost）。設定が無くても落ちない", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(siteUrl().toString()).toBe("http://localhost:3000/");
  });
});
