import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLegalKind, recordCurrentConsents } from "./legal-documents";

/** 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md 単体テスト */
describe("recordCurrentConsents", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("公開中の版（terms・privacy）に版つきで 2 行作る", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = {
      from: (table: string) =>
        table === "legal_documents"
          ? { select: () => ({ eq: async () => ({ data: [{ kind: "terms", version: "1.0" }, { kind: "privacy", version: "1.2" }], error: null }) }) }
          : { upsert },
    } as unknown as SupabaseClient;
    const now = new Date("2026-09-27T00:00:00Z");
    expect(await recordCurrentConsents(client, "u1", now)).toEqual({ recorded: 2 });
    expect(upsert).toHaveBeenCalledWith(
      [
        { user_id: "u1", kind: "terms", version: "1.0", agreed_at: now.toISOString() },
        { user_id: "u1", kind: "privacy", version: "1.2", agreed_at: now.toISOString() },
      ],
      { onConflict: "user_id,kind,version", ignoreDuplicates: true }
    );
  });

  it("失敗しても例外を投げない（登録を巻き込まない）", async () => {
    const client = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: "down" } }) }) }) } as unknown as SupabaseClient;
    expect(await recordCurrentConsents(client, "u1")).toEqual({ recorded: 0 });
  });

  it("isLegalKind", () => {
    expect(isLegalKind("terms")).toBe(true);
    expect(isLegalKind("cookie")).toBe(false);
  });
});
