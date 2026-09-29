import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { validateAnnouncementInput } from "@/lib/announcements/validate-announcement";

/**
 * F-AD-03 Task2: お知らせの一覧取得・作成（管理者のみ）
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md
 *
 * 1件の INSERT で全ユーザーの通知一覧（SC-14）に配信される（5.3）。非管理者・未ログインは404。
 */
export async function GET() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const { data, error } = await admin
    .from("system_announcements")
    .select("id, title, body, published_at, created_at, updated_at")
    .order("published_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { title?: unknown; body?: unknown; publishedAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const validation = validateAnnouncementInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await admin
    .from("system_announcements")
    .insert({
      title: validation.fields.title,
      body: validation.fields.body,
      published_at: validation.fields.publishedAt,
    })
    .select("id, title, body, published_at, created_at, updated_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 要件 3.10.12: 操作の記録（中で要件 7.5 の operation_logs にも残す）
  await recordAdminAction(admin, {
    actorId: user.id,
    action: "announcement_create",
    target: { type: "announcement", id: data.id, label: `お知らせ「${data.title}」` },
  });

  return NextResponse.json({ announcement: data }, { status: 201 });
}
