/**
 * 出典: docs/tasks/posts/draft/01-draft-save-api.md（単体テスト）「21 件目の下書きが拒否されること」
 */
import { describe, expect, it } from "vitest";
import { canCreateDraft } from "./draft-limits";

describe("canCreateDraft", () => {
  it("20 件未満なら作れる、20 件で拒否", () => {
    expect(canCreateDraft(0)).toBe(true);
    expect(canCreateDraft(19)).toBe(true);
    expect(canCreateDraft(20)).toBe(false);
  });
});
