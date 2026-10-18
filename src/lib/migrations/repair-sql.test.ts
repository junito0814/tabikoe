import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
// CI から node で直接動かすスクリプト（.mjs）を、そのまま読んでテストする
import { buildRepairSql, readVersions, versionOf } from "../../../scripts/migrations/build-repair-sql.mjs";

/**
 * 出典: Issue #944（マイグレーションを CI から当てる）の設計 手順 2
 *
 * 【初心者向け】このスクリプトが作る SQL は、**一度しか流さないが、間違えると表が壊れる**ものです。
 * 「52 本はもう当たっている」と DB に書き込むので、**1 本でも抜けるとその 1 本が後から流れます**
 * （既にある表を作ろうとして止まる）。手で並べない・抜けないことを、ここで押さえます。
 */
describe("buildRepairSql（#944）", () => {
  const fileCount = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).length;

  it("ファイル名の先頭の数字を版として取り出す", () => {
    expect(versionOf("20260907000001_create_users_table.sql")).toBe("20260907000001");
    expect(versionOf("README.md")).toBeNull();
    expect(versionOf("_no_version.sql")).toBeNull();
  });

  it("supabase/migrations の .sql をすべて拾う（1 本も落とさない）", () => {
    expect(readVersions().length).toBe(fileCount);
  });

  it("古い順に並ぶ", () => {
    const versions = readVersions();
    expect(versions).toEqual([...versions].sort());
  });

  it("版が重複していない", () => {
    const versions = readVersions();
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("二度流しても安全な SQL を作る（on conflict do nothing）", () => {
    const sql = buildRepairSql(["20260907000001", "20261017000001"]);
    expect(sql).toContain("on conflict (version) do nothing");
    expect(sql).toContain("insert into supabase_migrations.schema_migrations (version)");
  });

  it("本数を SQL のコメントに書く（当てたあとに突き合わせられるように）", () => {
    expect(buildRepairSql(["1", "2", "3"])).toContain("この 3 本は");
  });

  it("渡した版をすべて含む", () => {
    const versions = readVersions();
    const sql = buildRepairSql(versions);
    for (const version of versions) expect(sql).toContain(`'${version}'`);
  });
});
