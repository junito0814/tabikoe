import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { nextDisplayOrder } from "@/lib/posts/photos";

/**
 * F-PO-02 Task2: 既存投稿への写真追加
 * 出典: docs/tasks/posts/post-edit/02-media-edit-logic.md
 *
 * ファイル自体のアップロードは POST /api/posts/photos（作成時と共通）で先に済ませ、
 * ここではそのパスを既存の投稿へ紐づける。枚数上限はない（3.3.3）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { photoPaths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const photoPaths = Array.isArray(body.photoPaths)
    ? body.photoPaths.filter((path): path is string => typeof path === "string")
    : [];
  if (photoPaths.length === 0) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (post.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let startOrder: number;
  try {
    startOrder = await nextDisplayOrder(admin, id);
  } catch {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const { error: insertError } = await admin.from("post_photos").insert(
    photoPaths.map((storagePath, index) => ({
      post_id: id,
      media_type: "photo",
      storage_url: storagePath,
      display_order: startOrder + index,
    }))
  );

  if (insertError) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ added: photoPaths.length }, { status: 201 });
}
