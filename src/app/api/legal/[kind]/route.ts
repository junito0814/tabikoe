import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLegalDocument, isLegalKind, listLegalVersions } from "@/lib/legal/legal-documents";

/**
 * legal-documents Task 1: GET /api/legal/[kind]?version=（公開中の最新版、または指定の版）
 * 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
 *
 * 未ログインでも読める（同意画面から）。下書きは返さない。
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isLegalKind(kind)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const version = new URL(request.url).searchParams.get("version");
  try {
    const admin = createAdminClient();
    const [document, versions] = await Promise.all([getLegalDocument(admin, kind, version), listLegalVersions(admin, kind)]);
    if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ document, versions });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
