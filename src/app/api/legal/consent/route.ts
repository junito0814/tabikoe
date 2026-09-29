import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { CONSENT_COOKIE, consentCookieOptions, encodeConsentCookie } from "@/lib/auth/reconsent";
import { getPublishedVersions, isLegalKind, type LegalKind } from "@/lib/legal/legal-documents";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * legal-documents Task 3: POST /api/legal/consent（公開中の版に同意する）
 * 出典: docs/tasks/admin/legal-documents/03-reconsent.md
 *
 * body: { kinds: ("terms" | "privacy")[] }。指定した種類の公開中の版を user_consents に記録し、
 * 同意済みの印（Cookie）も更新して、次のリクエストから関所を通れるようにする。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { kinds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter(isLegalKind) : [];
  if (kinds.length === 0) return NextResponse.json({ error: "kinds_required" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const published = await getPublishedVersions(admin);
    const rows = kinds.filter((kind): kind is LegalKind => !!published[kind]).map((kind) => ({ user_id: user.id, kind, version: published[kind]!, agreed_at: new Date().toISOString() }));
    if (rows.length > 0) {
      const { error } = await admin.from("user_consents").upsert(rows, { onConflict: "user_id,kind,version", ignoreDuplicates: true });
      if (error) throw error;
    }
    // 全種類に同意済みかは関所が次に確かめる。ここでは「いま公開中の版に同意した」印を置く
    const { data: all } = await admin.from("user_consents").select("kind, version").eq("user_id", user.id);
    const agreed = new Set(((all ?? []) as { kind: string; version: string }[]).map((c) => `${c.kind}:${c.version}`));
    const complete = (Object.entries(published) as [LegalKind, string][]).every(([kind, version]) => agreed.has(`${kind}:${version}`));
    const response = NextResponse.json({ ok: true, recorded: rows.length, complete });
    if (complete) response.cookies.set(CONSENT_COOKIE, encodeConsentCookie(published), consentCookieOptions(sessionCookieOptions.secure));
    return response;
  } catch {
    return NextResponse.json({ error: "consent_failed" }, { status: 500 });
  }
}
