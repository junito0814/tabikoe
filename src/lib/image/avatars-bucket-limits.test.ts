import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./process-upload";

/**
 * 出典: Issue #899（avatars バケットにも、大きさ上限と受付形式を掛ける）
 *
 * 【初心者向け】同じ数字が 2 か所にあります ── アプリ側（`process-upload.ts`）と
 * Storage 側（マイグレーション）。**ずれると原因が分かりにくい不具合**になります
 * （アプリは通すのに Storage が弾く、またはその逆。画面には Storage の素のエラーが出る）。
 *
 * 片方だけ直してズレるのを防ぐため、**ここで突き合わせます**（約束 14）。
 * マイグレーションは一度当てたら書き換えないものなので、**値を変えるときは
 * 新しいマイグレーションを足し、このテストの参照先も差し替える**ことになります。
 */
const MIGRATION = "supabase/migrations/20261017000002_avatars_bucket_limits_apply.sql";

describe("avatars バケットの制限が、アプリ側の値と一致している（#899）", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("大きさの上限が同じ", () => {
    const match = sql.match(/file_size_limit = (\d+)/);
    expect(match, "file_size_limit が書かれていない").not.toBeNull();
    expect(Number(match![1])).toBe(MAX_FILE_SIZE_BYTES);
  });

  it("受け付ける形式が同じ", () => {
    const match = sql.match(/allowed_mime_types = array\[(.*?)\]/);
    expect(match, "allowed_mime_types が書かれていない").not.toBeNull();
    const types = match![1].split(",").map((part) => part.trim().replace(/'/g, ""));
    expect(types).toEqual([...ALLOWED_MIME_TYPES]);
  });

  it("対象は avatars バケット（ほかのバケットを巻き込んでいない）", () => {
    expect(sql).toMatch(/where id = 'avatars'/);
    expect(sql).not.toMatch(/where id = 'post-media'/);
  });
});
