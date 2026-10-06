import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { getLegalDocument, listLegalVersions } from "@/lib/legal/legal-documents";
import { resolveListBack } from "@/lib/search/list-state";

export const dynamic = "force-dynamic";

/**
 * legal-documents Task 1: 個人情報保護方針の公開ページ（/privacy）
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *
 * 未ログインでも読める（同意画面 SC-20 からのリンク先）。?version= で過去の版
 */
export default async function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  const params = await searchParams;
  const version = typeof params.version === "string" ? params.version : null;
  // #792: 来た画面（アカウント・同意画面など）。無ければホーム
  const back = resolveListBack(typeof params.back === "string" ? params.back : null);
  const admin = createAdminClient();
  const [document, versions] = await Promise.all([getLegalDocument(admin, "privacy", version).catch(() => null), listLegalVersions(admin, "privacy").catch(() => [])]);
  if (!document) notFound();
  return <LegalDocumentScreen document={document} versions={versions} back={back} />;
}
