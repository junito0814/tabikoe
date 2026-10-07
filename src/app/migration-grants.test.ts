import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * 2026-10-07: 新しい表を作ったら、必ず service_role に権限を渡す。
 *
 * 【初心者向け】なぜこのテストが要るのか。
 *   ふつうの Supabase では、作った表に既定で権限が付きます。ところがこのプロジェクトは
 *   20260908000008（harden_privileges）と 20260908000012 で**その既定を外しています**
 *   （匿名の鍵だけで他人のアカウントを消せた・自分を管理者にできた、という実際の穴をふさぐため）。
 *
 *   その代わり、**表を 1 つ作るたびに grant を書く**必要があります。これを忘れると
 *   表は出来るのに誰も読み書きできず、しかも**画面には何も出ません**
 *   （タビコエは「数えられなかったときは 0 件」として黙る作りなので、気づけない）。
 *   実際 #754 の announcement_reads で起きました。見落としやすいので機械に見張らせます。
 *
 * 置き場所について: vitest は `src/**` しか見ないので、`supabase/` ではなくここに置いている。
 */
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((name) => name.endsWith(".sql")).sort();
const all = files.map((name) => readFileSync(`${DIR}/${name}`, "utf8")).join("\n");

/** マイグレーション全体で作られる public の表の名前 */
function createdTables(): string[] {
  const names = new Set<string>();
  for (const match of all.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

/**
 * service_role に権限を渡してある表の名前。
 *
 * 【初心者向け】`grant ... to service_role;` は 1 文で複数の表をまとめて書けるので
 * （20260908000012 がそう書いている）、1 行ずつ見ても拾えません。
 * **`;` で文に区切ってから**、その文の中の `public.◯◯` を全部集めます。
 */
function grantedToServiceRole(): Set<string> {
  const granted = new Set<string>();
  for (const statement of all.split(";")) {
    const text = statement.toLowerCase();
    if (!text.includes("grant") || !text.includes("service_role")) continue;
    // 関数への grant execute は表ではないので除く
    if (text.includes("on function")) continue;
    for (const match of statement.matchAll(/public\.(\w+)/g)) granted.add(match[1]);
  }
  return granted;
}

describe("マイグレーションの権限", () => {
  it("表を作るマイグレーションがある", () => {
    expect(createdTables().length).toBeGreaterThan(20);
  });

  it("作った表にはすべて service_role への grant がある", () => {
    const missing = createdTables().filter((table) => !grantedToServiceRole().has(table));
    expect(missing, `service_role に権限を渡していない表: ${missing.join("、")}`).toEqual([]);
  });

  it("既定の権限を外した理由が、外したマイグレーションに書いてある", () => {
    const harden = readFileSync(`${DIR}/20260908000008_harden_privileges.sql`, "utf8");
    expect(harden).toContain("revoke");
    expect(harden).toContain("service_role");
  });
});
