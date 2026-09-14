import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { nextDisplayOrder } from "@/lib/posts/photos";
import { parseMediaInput, toPostPhotoRows } from "@/lib/posts/media-input";

/**
 * F-PO-02 Task2: 既存投稿への写真・動画の追加
 * 出典: docs/tasks/posts/post-edit/02-media-edit-logic.md
 *       docs/tasks/posts/video-upload/03-post-media-integration.md
 *
 * ファイル自体の処理は POST /api/posts/photos・POST /api/posts/videos（作成時と共通）で
 * 先に済ませ、ここではその結果を既存の投稿へ紐づける。枚数上限はない（3.3.3）。
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

  let body: { photoPaths?: unknown; media?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const mediaInput = parseMediaInput(body, user.id);
  if (!mediaInput.ok) {
    return NextResponse.json(
      { error: mediaInput.error === "media_required" ? "photo_required" : mediaInput.error },
      { status: 400 }
    );
  }
  const media = mediaInput.items;

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

  const { error: insertError } = await admin
    .from("post_photos")
    .insert(toPostPhotoRows(id, media, startOrder));

  if (insertError) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ added: media.length }, { status: 201 });
}
