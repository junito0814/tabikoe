import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { compareVersions, isValidVersion, publishLegalDocument, saveLegalDraft, validateLegalDraftInput } from "./legal-admin";

/** 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md 単体テスト */
describe("版の比較と入力規則", () => {
  it("版は数字の並びで比べる（1.10 > 1.9）", () => {
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0")).toBe(0);
    expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
    expect(isValidVersion("1.2.3")).toBe(true);
    expect(isValidVersion("v1")).toBe(false);
  });

  it("下書きの入力規則", () => {
    expect(validateLegalDraftInput({ version: " 1.1 ", summary: "要点", body: "# 本文" })).toEqual({ ok: true, fields: { version: "1.1", summary: "要点", body: "# 本文" } });
    expect(validateLegalDraftInput({ version: "x", body: "a" })).toEqual({ ok: false, error: "invalid_version" });
    expect(validateLegalDraftInput({ version: "1.1", body: " " })).toEqual({ ok: false, error: "body_required" });
  });
});

function fakeAdmin(doc: Record<string, unknown> | null, published: Record<string, unknown> | null) {
  const calls: string[] = [];
  // legal_documents への select は 1 回目が「その id の行」、2 回目が「公開中の版」
  let selects = 0;
  const client = {
    from: (table: string) => ({
      select: () => {
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.maybeSingle = async () => {
          if (table !== "legal_documents") return { data: { display_name: "x" }, error: null };
          selects += 1;
          return { data: selects === 1 ? doc : published, error: null };
        };
        return c;
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => {
          calls.push(`update:${id}:${payload.status ?? Object.keys(payload).join(",")}`);
          return { error: null };
        },
      }),
      insert: async (payload: Record<string, unknown>) => {
        calls.push(`${table}.insert:${payload.title ?? payload.action}`);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("publishLegalDocument", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("下書きを公開し、前の版を archived にし、お知らせと記録を作る", async () => {
    const draft = { id: "d2", kind: "terms", version: "1.1", summary: "ストライク制を追加", body: "x", status: "draft", published_at: null };
    const { client, calls } = fakeAdmin(draft, { id: "d1", version: "1.0" });
    const result = await publishLegalDocument(client, { adminId: "admin-1", id: "d2", now: new Date("2026-09-27T00:00:00Z") });
    expect(result).toEqual({ ok: true, version: "1.1", kind: "terms" });
    expect(calls).toEqual([
      "update:d1:archived",
      "update:d2:published",
      "system_announcements.insert:利用規約を改定しました（版 1.1）",
      "admin_actions.insert:legal_publish",
      "operation_logs.insert:undefined",
    ]);
  });

  it("公開済みのものや、公開中より新しくない版は公開できない", async () => {
    const { client } = fakeAdmin({ id: "d1", kind: "terms", version: "1.0", summary: "", body: "x", status: "published", published_at: "2026-09-01T00:00:00Z" }, null);
    expect(await publishLegalDocument(client, { adminId: "a", id: "d1" })).toEqual({ ok: false, error: "not_draft" });
    const { client: c2 } = fakeAdmin({ id: "d2", kind: "terms", version: "1.0", summary: "", body: "x", status: "draft", published_at: null }, { id: "d1", version: "1.0" });
    expect(await publishLegalDocument(c2, { adminId: "a", id: "d2" })).toEqual({ ok: false, error: "version_not_newer" });
  });
});

/*
 * #889（2026-10-07）: 利用規約と個人情報保護方針が互いに上書きされていた。
 *
 * 【初心者向け】画面側で、タブを切り替えても編集中の `id` が入れ替わらず、
 * 「利用規約の下書きの id」に個人情報保護方針の本文を保存していた。
 * 画面は直したが、**API も画面を信じてはいけない** ── 別の経路から同じことが起きるので、
 * サーバー側で種類の食い違いを断る。
 */
describe("saveLegalDraft の種類の確かめ（#889）", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  /** 1 回目の select が「その id の行」、2 回目が「公開中の版」。ここでは公開中は無しにする */
  function adminWith(doc: Record<string, unknown> | null) {
    // fakeAdmin は select の 1 回目を doc、2 回目を published として返すが、
    // saveLegalDraft は「公開中の版」→「その id の行」の順に引くので入れ替えて渡す
    return fakeAdmin(null, doc);
  }

  it("種類が食い違う id では保存しない（利用規約の下書きに個人情報保護方針を書き込ませない）", async () => {
    const { client, calls } = adminWith({ id: "d1", kind: "terms", version: "1.2", summary: "", body: "規約の本文", status: "draft", published_at: null });
    const result = await saveLegalDraft(client, { kind: "privacy", id: "d1", version: "1.2", summary: "", body: "方針の本文" });
    expect(result).toEqual({ ok: false, error: "not_found" });
    // 書き込みが 1 つも起きていない
    expect(calls.filter((c) => c.startsWith("update:"))).toEqual([]);
  });

  it("種類が合っていれば今までどおり保存する", async () => {
    const { client, calls } = adminWith({ id: "d1", kind: "privacy", version: "1.2", summary: "", body: "前の本文", status: "draft", published_at: null });
    const result = await saveLegalDraft(client, { kind: "privacy", id: "d1", version: "1.2", summary: "", body: "新しい本文" });
    expect(result).toEqual({ ok: true, id: "d1" });
    expect(calls.some((c) => c.startsWith("update:d1:"))).toBe(true);
  });

  it("公開済みの版は直せない（今までどおり）", async () => {
    const { client } = adminWith({ id: "d1", kind: "privacy", version: "1.2", summary: "", body: "本文", status: "published", published_at: "2026-10-01" });
    expect(await saveLegalDraft(client, { kind: "privacy", id: "d1", version: "1.2", summary: "", body: "x" })).toEqual({ ok: false, error: "not_draft" });
  });
});

/*
 * #889: 画面側の直し。タブ（?kind=）を切り替えたら部品を作り直す。
 * 【初心者向け】`useState` の初期値はいちばん最初しか見ないので、`key` で作り直さないと
 * 前のタブの下書きの id と本文が残る。見た目では気づけないので、ここで見張る。
 */
describe("規約管理の画面（#889）", () => {
  it("種類を key にして部品を作り直している", () => {
    const page = readFileSync("src/app/admin/(shell)/legal/page.tsx", "utf8");
    expect(page).toContain("<LegalAdminScreen key={kind}");
  });
});
