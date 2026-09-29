import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { getLegalDocument, listLegalVersions } from "@/lib/legal/legal-documents";

export const dynamic = "force-dynamic";

/**
 * legal-documents Task 1: 利用規約の公開ページ（/terms）
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *
 * 未ログインでも読める（同意画面 SC-20 からのリンク先）。?version= で過去の版
 */
export default async function TermsPage({ searchParams }: PageProps<"/terms">) {
  const params = await searchParams;
  const version = typeof params.version === "string" ? params.version : null;
  const admin = createAdminClient();
  const [document, versions] = await Promise.all([getLegalDocument(admin, "terms", version).catch(() => null), listLegalVersions(admin, "terms").catch(() => [])]);
  if (!document) notFound();
  return <LegalDocumentScreen document={document} versions={versions} />;
}
