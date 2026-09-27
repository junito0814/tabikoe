import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { LegalAdminScreen } from "@/components/admin/LegalAdminScreen";
import { isLegalKind, type LegalDocument, type LegalKind } from "@/lib/legal/legal-documents";
import { getLegalDocumentById, listLegalVersionsForAdmin } from "@/lib/legal/legal-admin";

export const dynamic = "force-dynamic";

/**
 * legal-documents Task 2: 規約管理（SC-26）
 * 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md
 *
 * 種類は URL（?kind=terms|privacy）。下書きがあればそれを、無ければ公開中の本文を下敷きに新しい下書きを編集する
 */
export default async function AdminLegalPage({ searchParams }: PageProps<"/admin/legal">) {
  const params = await searchParams;
  const kind: LegalKind = isLegalKind(params.kind) ? params.kind : "terms";
  const admin = createAdminClient();
  let loaded: { draft: LegalDocument | null; versions: Awaited<ReturnType<typeof listLegalVersionsForAdmin>> } | null = null;
  try {
    const versions = await listLegalVersionsForAdmin(admin, kind);
    const draftRow = versions.versions.find((v) => v.status === "draft") ?? null;
    const publishedRow = versions.versions.find((v) => v.status === "published") ?? null;
    let draft = draftRow ? await getLegalDocumentById(admin, draftRow.id) : null;
    // 下書きが無ければ、公開中の本文を下敷きにした「まだ保存していない下書き」（id は空）を渡す
    if (!draft && publishedRow) {
      const base = await getLegalDocumentById(admin, publishedRow.id);
      if (base) draft = { ...base, id: "", status: "draft", version: "", summary: "", publishedAt: null };
    }
    loaded = { draft, versions };
  } catch {
    loaded = null;
  }
  if (!loaded) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  return <LegalAdminScreen kind={kind} draft={loaded.draft} versions={loaded.versions.versions} totalUsers={loaded.versions.totalUsers} />;
}
