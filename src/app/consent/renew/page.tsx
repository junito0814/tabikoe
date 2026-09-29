import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { missingConsents } from "@/lib/auth/reconsent";
import { getLegalDocument, getPublishedVersions } from "@/lib/legal/legal-documents";
import { ReconsentScreen, type ReconsentItem } from "@/components/legal/ReconsentScreen";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

/**
 * legal-documents Task 3: 規約の再同意（SC-30）
 * 出典: docs/tasks/admin/legal-documents/03-reconsent.md
 *
 * 関所（proxy.ts）が再同意の要る人をここへ送る。未同意の種類だけを出し、無ければ元の場所へ戻す
 */
export default async function ReconsentPage({ searchParams }: PageProps<"/consent/renew">) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/consent/renew");
  const params = await searchParams;
  const redirectTo = safeRedirectPath(typeof params.redirect_to === "string" ? params.redirect_to : null);

  const admin = createAdminClient();
  const [published, consents] = await Promise.all([getPublishedVersions(admin), admin.from("user_consents").select("kind, version").eq("user_id", user.id)]);
  const missing = missingConsents(published, (consents.data ?? []) as { kind: string; version: string }[]);
  if (missing.length === 0) redirect(redirectTo);

  const items: ReconsentItem[] = [];
  for (const kind of missing) {
    const document = await getLegalDocument(admin, kind);
    if (document) items.push({ kind, version: document.version, summary: document.summary });
  }
  if (items.length === 0) redirect(redirectTo);
  return <ReconsentScreen items={items} redirectTo={redirectTo} />;
}
