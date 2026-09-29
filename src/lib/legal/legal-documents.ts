import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * legal-documents Task 1: 規約（利用規約・個人情報保護方針）の読み出しと同意の記録
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *       要件定義書 3.10.11「規約管理」・7.4
 *
 * 【初心者向け】本文は Markdown で legal_documents に版ごとに入っている。公開ページ（/terms・/privacy）は
 * 公開中の版（status = published）を出し、過去の版（archived）も読める。
 * 同意は user_consents に「種類・版・日時」で残す（登録時と再同意）。
 */
export const LEGAL_KINDS = ["terms", "privacy"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export const LEGAL_KIND_LABELS: Record<LegalKind, string> = { terms: "利用規約", privacy: "個人情報保護方針" };
export const LEGAL_KIND_PATHS: Record<LegalKind, string> = { terms: "/terms", privacy: "/privacy" };

export function isLegalKind(value: unknown): value is LegalKind {
  return (LEGAL_KINDS as readonly string[]).includes(String(value));
}

export interface LegalDocument {
  id: string;
  kind: LegalKind;
  version: string;
  summary: string;
  body: string;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
}

function toDocument(row: Record<string, unknown>): LegalDocument {
  return {
    id: row.id as string,
    kind: row.kind as LegalKind,
    version: row.version as string,
    summary: (row.summary as string) ?? "",
    body: row.body as string,
    status: row.status as LegalDocument["status"],
    publishedAt: (row.published_at as string | null) ?? null,
  };
}

const COLUMNS = "id, kind, version, summary, body, status, published_at";

/** 公開中の版（version を指定すれば過去の版も） */
export async function getLegalDocument(client: SupabaseClient, kind: LegalKind, version?: string | null): Promise<LegalDocument | null> {
  let query = client.from("legal_documents").select(COLUMNS).eq("kind", kind);
  query = version ? query.eq("version", version).neq("status", "draft") : query.eq("status", "published");
  const { data, error } = await query.order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? toDocument(data) : null;
}

/** 公開中・過去の版の一覧（新しい順） */
export async function listLegalVersions(client: SupabaseClient, kind: LegalKind): Promise<{ version: string; status: string; publishedAt: string | null }[]> {
  const { data, error } = await client.from("legal_documents").select("version, status, published_at").eq("kind", kind).neq("status", "draft").order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ version: row.version as string, status: row.status as string, publishedAt: (row.published_at as string | null) ?? null }));
}

/** 公開中の版の番号（種類ごと）。無ければ含めない */
export async function getPublishedVersions(admin: SupabaseClient): Promise<Partial<Record<LegalKind, string>>> {
  const { data, error } = await admin.from("legal_documents").select("kind, version").eq("status", "published");
  if (error) throw error;
  const result: Partial<Record<LegalKind, string>> = {};
  for (const row of (data ?? []) as { kind: LegalKind; version: string }[]) result[row.kind] = row.version;
  return result;
}

/** 公開中の全種類に同意した記録を残す（登録時）。同じ版への重複は無視。例外は投げない */
export async function recordCurrentConsents(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<{ recorded: number }> {
  try {
    const versions = await getPublishedVersions(admin);
    const rows = (Object.entries(versions) as [LegalKind, string][]).map(([kind, version]) => ({ user_id: userId, kind, version, agreed_at: now.toISOString() }));
    if (rows.length === 0) return { recorded: 0 };
    const { error } = await admin.from("user_consents").upsert(rows, { onConflict: "user_id,kind,version", ignoreDuplicates: true });
    if (error) throw error;
    return { recorded: rows.length };
  } catch (error) {
    console.error("[legal] 同意の記録に失敗しました:", error instanceof Error ? error.message : error);
    return { recorded: 0 };
  }
}
