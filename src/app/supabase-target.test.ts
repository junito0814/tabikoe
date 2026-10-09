import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
// scripts/ の .mjs から、判断の部分だけを読み込んでテストする
import { resolveTarget, wantsProduction } from "../../scripts/supabase-target.mjs";

/**
 * #896（2026-10-09）: データを触るスクリプトの「繋ぎ先」を見張る。
 *
 * 【初心者向け】なぜ要るのか。
 *   2026-10-07 に提出し、担当の方が本番を触っている。それなのに seed や掃除のスクリプトは
 *   `.env.local` の**本番の鍵をそのまま読んでいた**ので、`node scripts/seed/seed-tokyo.mjs` と
 *   打つだけで本番が書き換わった。実際その日に本番のスポット 51 件と写真 86 枚を入れ替えている。
 *
 *   いまは**既定が開発用**で、本番に当てるには `--production` が要る。
 *   この「既定で安全な側に倒す」性質が、あとから元に戻されないように見張る。
 *
 * 置き場所について: vitest は `src/**` しか見ないので、`scripts/` ではなくここに置いている。
 */
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://prod-ref.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_prod",
  DEV_SUPABASE_URL: "https://dev-ref.supabase.co",
  DEV_SUPABASE_SECRET_KEY: "sb_secret_dev",
};

describe("繋ぎ先の決め方（#896）", () => {
  it("何も付けなければ開発用に繋ぐ", () => {
    const target = resolveTarget(ENV, ["node", "seed-tokyo.mjs"]);
    expect(target.isProduction).toBe(false);
    expect(target.url).toBe(ENV.DEV_SUPABASE_URL);
    expect(target.key).toBe(ENV.DEV_SUPABASE_SECRET_KEY);
  });

  it("--apply のような他の指定があっても、開発用のまま", () => {
    expect(resolveTarget(ENV, ["node", "clean-seed.mjs", "--apply"]).isProduction).toBe(false);
  });

  it("--production を付けたときだけ本番に繋ぐ", () => {
    const target = resolveTarget(ENV, ["node", "seed-tokyo.mjs", "--production"]);
    expect(target.isProduction).toBe(true);
    expect(target.url).toBe(ENV.NEXT_PUBLIC_SUPABASE_URL);
    expect(target.key).toBe(ENV.SUPABASE_SECRET_KEY);
  });

  it("似た綴りでは本番にならない（--prod や --production=1 では切り替わらない）", () => {
    for (const flag of ["--prod", "--production=1", "production", "-production"]) {
      expect(wantsProduction(["node", "x.mjs", flag]), flag).toBe(false);
    }
  });

  it("開発用の設定が無いとき、黙って本番へ落ちない", () => {
    const withoutDev = { NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY: ENV.SUPABASE_SECRET_KEY };
    expect(() => resolveTarget(withoutDev, ["node", "seed-tokyo.mjs"])).toThrow(/DEV_SUPABASE_URL/);
  });

  it("--production を付けたのに本番の設定が無いときも止まる", () => {
    const withoutProd = { DEV_SUPABASE_URL: ENV.DEV_SUPABASE_URL, DEV_SUPABASE_SECRET_KEY: ENV.DEV_SUPABASE_SECRET_KEY };
    expect(() => resolveTarget(withoutProd, ["node", "x.mjs", "--production"])).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("データを触るスクリプトは、繋ぎ先を自分で決めない（#896）", () => {
  /** Supabase に書き込みうるスクリプト。両方を見比べる compare-projects.mjs だけは例外 */
  const EXCEPTIONS = new Set(["supabase-target.mjs", "compare-projects.mjs", "build-new-project-sql.mjs"]);

  function scriptsUsingSupabase(): string[] {
    const found: string[] = [];
    for (const dir of ["scripts", "scripts/seed"]) {
      for (const name of readdirSync(dir)) {
        if (!name.endsWith(".mjs") || EXCEPTIONS.has(name)) continue;
        const path = `${dir}/${name}`;
        const source = readFileSync(path, "utf8");
        if (source.includes("supabase-target.mjs") || source.includes("createClient(")) found.push(path);
      }
    }
    return found.sort();
  }

  it("見張る対象のスクリプトがある（読み取りに失敗していない）", () => {
    expect(scriptsUsingSupabase().length).toBeGreaterThan(5);
  });

  it("どれも共通の connect() を通し、本番の鍵を直接読まない", () => {
    for (const path of scriptsUsingSupabase()) {
      const source = readFileSync(path, "utf8");
      expect(source, `${path} が supabase-target.mjs を使っていない`).toContain("supabase-target.mjs");
      expect(source, `${path} が本番の鍵を直接読んでいる`).not.toContain("env.SUPABASE_SECRET_KEY");
      expect(source, `${path} が本番の URL を直接読んでいる`).not.toContain("env.NEXT_PUBLIC_SUPABASE_URL");
    }
  });
});
