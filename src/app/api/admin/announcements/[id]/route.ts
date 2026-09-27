import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { validateAnnouncementInput } from "@/lib/announcements/validate-announcement";

/**
 * F-AD-03 Task2: お知らせの編集・削除（管理者のみ）
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  // 指定したレコードにのみ作用させる（id 条件）
  const { data, error } = await admin
    .from("system_announcements")
    .update({
      title: validation.fields.title,
      body: validation.fields.body,
      published_at: validation.fields.publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, title, body, published_at, created_at, updated_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await recordAdminAction(admin, {
    actorId: user.id,
    action: "announcement_update",
    target: { type: "announcement", id, label: `お知らせ「${data.title}」` },
  });

  return NextResponse.json({ announcement: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = await requireAdminUser(supabase, admin);
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const { data, error } = await admin
    .from("system_announcements")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await recordAdminAction(admin, {
    actorId: user.id,
    action: "announcement_delete",
    target: { type: "announcement", id, label: `お知らせ ${id.slice(0, 8)}` },
  });

  return NextResponse.json({ deleted: true });
}
