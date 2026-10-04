import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * 出典: #706（本番の関数を東京リージョンで動かす）
 * #689 の調査・要件定義書 7.5「デプロイ」
 *
 * 【初心者向け】タビコエのデータベース（Supabase）は東京にある。
 * ところが本番の応答ヘッダ `x-vercel-id` が `hnd1::iad1::...` で、
 * **受け付けたのは東京、実際に動いたのはワシントン**だった。
 * 問い合わせ 1 回ごとに太平洋を往復するので、1 往復が 88 ms → 170〜200 ms に伸びていた。
 *
 * `vercel.json` が無いと Vercel の既定（`iad1` ＝ ワシントン）になる。
 * **この 1 行が消えたり別のリージョンに変わったりすると、またアメリカで動き始める。**
 * 画面を見ても気づけない（ただ遅くなるだけ）ので、ここで機械に見張らせる。
 */
const CONFIG_PATH = "vercel.json";

/** 東京。Supabase の ap-northeast-1（東京）と同じ場所 */
const TOKYO = "hnd1";

describe("本番の関数は東京で動かす", () => {
  it("vercel.json がある（無いと既定のワシントンになる）", () => {
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { regions?: unknown };

  it("リージョンが東京ひとつだけ", () => {
    // 無料枠（Hobby）で選べるのは 1 つだけ。日本向けのサービスなので東京にする
    expect(config.regions).toEqual([TOKYO]);
  });
});
