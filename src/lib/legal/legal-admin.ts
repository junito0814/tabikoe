import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { LEGAL_KIND_LABELS, LEGAL_KIND_PATHS, type LegalDocument, type LegalKind } from "./legal-documents";

/**
 * legal-documents Task 2: 規約管理（下書き・公開・版の一覧）
 * 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md
 *       要件定義書 3.10.11「規約管理」・3.9.1「規約の改定」
 *
 * 【初心者向け】版は「1.0」「1.1」のような文字列で、下書き → 公開で上がる。公開すると
 *   1. その版が published、同じ種類の前の公開版は archived
 *   2. 全員向けの通知「規約の改定」を運営からのお知らせ（system_announcements）として 1 件作る
 *   3. 操作の記録 legal_publish
 * 公開したあと、利用者には次に開いたときに再同意画面（Task 3）が出る。
 */
export const MAX_LEGAL_SUMMARY_LENGTH = 300;
export const MAX_LEGAL_BODY_LENGTH = 40000;

export interface LegalVersionRow {
  id: string;
  version: string;
  status: LegalDocument["status"];
  summary: string;
  publishedAt: string | null;
  updatedAt: string;
  /** その版に同意した人数（公開中・過去の版だけ） */
  consentedCount: number;
}

/** 版の比較（"1.10" > "1.9"）。数字の並びとして比べる。純粋関数 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isValidVersion(value: string): boolean {
  return /^\d+(\.\d+){0,2}$/.test(value);
}

/** 下書きの入力規則（純粋関数） */
export function validateLegalDraftInput(body: unknown): { ok: true; fields: { version: string; summary: string; body: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const version = typeof b.version === "string" ? b.version.trim() : "";
  if (!isValidVersion(version)) return { ok: false, error: "invalid_version" };
  const summary = typeof b.summary === "string" ? b.summary.trim() : "";
  if ([...summary].length > MAX_LEGAL_SUMMARY_LENGTH) return { ok: false, error: "summary_too_long" };
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (!text) return { ok: false, error: "body_required" };
  if ([...text].length > MAX_LEGAL_BODY_LENGTH) return { ok: false, error: "body_too_long" };
  return { ok: true, fields: { version, summary, body: text } };
}

export async function listLegalVersionsForAdmin(admin: SupabaseClient, kind: LegalKind): Promise<{ versions: LegalVersionRow[]; totalUsers: number }> {
  const [docs, consents, users] = await Promise.all([
    admin.from("legal_documents").select("id, version, status, summary, published_at, updated_at").eq("kind", kind),
    admin.from("user_consents").select("version").eq("kind", kind),
    admin.from("users").select("id", { count: "exact", head: true }).eq("is_deleted", false),
  ]);
  if (docs.error) throw docs.error;
  if (consents.error) throw consents.error;
  const countByVersion = new Map<string, number>();
  for (const row of (consents.data ?? []) as { version: string }[]) countByVersion.set(row.version, (countByVersion.get(row.version) ?? 0) + 1);
  const versions = ((docs.data ?? []) as { id: string; version: string; status: LegalDocument["status"]; summary: string; published_at: string | null; updated_at: string }[])
    .map((d) => ({ id: d.id, version: d.version, status: d.status, summary: d.summary, publishedAt: d.published_at, updatedAt: d.updated_at, consentedCount: countByVersion.get(d.version) ?? 0 }))
    .sort((a, b) => compareVersions(b.version, a.version));
  return { versions, totalUsers: users.count ?? 0 };
}

export async function getLegalDocumentById(admin: SupabaseClient, id: string): Promise<LegalDocument | null> {
  const { data, error } = await admin.from("legal_documents").select("id, kind, version, summary, body, status, published_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, kind: data.kind as LegalKind, version: data.version as string, summary: (data.summary as string) ?? "", body: data.body as string, status: data.status as LegalDocument["status"], publishedAt: (data.published_at as string | null) ?? null };
}

/** 下書きを作る／直す（同じ種類に下書きは 1 つ。公開済みの版は直せない） */
export async function saveLegalDraft(
  admin: SupabaseClient,
  input: { kind: LegalKind; id?: string | null; version: string; summary: string; body: string }
): Promise<{ ok: true; id: string } | { ok: false; error: "not_draft" | "not_found" | "version_not_newer" | "version_exists" }> {
  const { data: published } = await admin.from("legal_documents").select("version").eq("kind", input.kind).eq("status", "published").maybeSingle();
  if (published && compareVersions(input.version, published.version as string) <= 0) return { ok: false, error: "version_not_newer" };

  if (input.id) {
    const current = await getLegalDocumentById(admin, input.id);
    if (!current) return { ok: false, error: "not_found" };
    if (current.status !== "draft") return { ok: false, error: "not_draft" };
    const { error } = await admin
      .from("legal_documents")
      .update({ version: input.version, summary: input.summary, body: input.body, updated_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return error.code === "23505" ? { ok: false, error: "version_exists" } : Promise.reject(error);
    return { ok: true, id: input.id };
  }
  const { data, error } = await admin
    .from("legal_documents")
    .insert({ kind: input.kind, version: input.version, summary: input.summary, body: input.body, status: "draft" })
    .select("id")
    .single();
  if (error) return error.code === "23505" ? { ok: false, error: "version_exists" } : Promise.reject(error);
  return { ok: true, id: data.id as string };
}

/** 下書きを公開する。前の公開版は archived。全員にお知らせ、操作の記録 */
export async function publishLegalDocument(
  admin: SupabaseClient,
  input: { adminId: string; id: string; now?: Date }
): Promise<{ ok: true; version: string; kind: LegalKind } | { ok: false; error: "not_found" | "not_draft" | "version_not_newer" }> {
  const now = input.now ?? new Date();
  const doc = await getLegalDocumentById(admin, input.id);
  if (!doc) return { ok: false, error: "not_found" };
  if (doc.status !== "draft") return { ok: false, error: "not_draft" };
  const { data: published } = await admin.from("legal_documents").select("id, version").eq("kind", doc.kind).eq("status", "published").maybeSingle();
  if (published && compareVersions(doc.version, published.version as string) <= 0) return { ok: false, error: "version_not_newer" };

  if (published) {
    const { error } = await admin.from("legal_documents").update({ status: "archived", updated_at: now.toISOString() }).eq("id", published.id as string);
    if (error) throw error;
  }
  const { error } = await admin
    .from("legal_documents")
    .update({ status: "published", published_at: now.toISOString(), published_by: input.adminId, updated_at: now.toISOString() })
    .eq("id", input.id);
  if (error) throw error;

  // 3.9.1「規約の改定」: 全員向けの通知は運営からのお知らせとして 1 件（新しい通知の種類は増やさない）
  const label = LEGAL_KIND_LABELS[doc.kind];
  const { error: announceError } = await admin.from("system_announcements").insert({
    title: `${label}を改定しました（版 ${doc.version}）`,
    body: `${doc.summary ? `変更の要点：\n${doc.summary}\n\n` : ""}全文は ${LEGAL_KIND_PATHS[doc.kind]} で読めます。次にアプリを開いたときに、改めて同意をお願いします。`,
    published_at: now.toISOString(),
  });
  if (announceError) console.error("[legal] 改定のお知らせを作れませんでした:", announceError.message);

  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "legal_publish",
    target: { type: "legal_document", id: input.id, label: `${label} 版 ${doc.version}` },
    note: doc.summary || null,
  });
  return { ok: true, version: doc.version, kind: doc.kind };
}
