import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { POST_MEDIA_BUCKET } from "@/lib/posts/constants";
import { MAX_UPLOAD_SLOTS, tempUploadPath } from "@/lib/posts/upload-slots";

/**
 * #860: 写真を**ブラウザから Storage へ直接**上げるための、署名付きアップロード URL を配る
 * 出典: Issue #860「Bug 5: 4.5MB を超える写真が投稿できない（Vercel が本文を関数に渡さない）」
 *
 * 【初心者向け】なぜこれが要るのか。
 *   これまでは「ブラウザ → この関数 → Storage」の順にファイルの実体を通していました。
 *   ところが **Vercel は約 4.5MB を超えた本文を、関数に渡す前に捨てます**（本番で実測）。
 *   そのため 4.5MB〜10MB の写真はサーバーのコードに届かず、投稿できませんでした
 *   （要件 3.3.1 は「写真は 1 点あたり最大 10MB」）。
 *
 *   そこで実体は**この関数を通しません**。ここでは「上げてよいか」を確かめて、
 *   **置き場所と鍵（署名付き URL）だけ**を返します。本文は数百バイトなので上限にかかりません。
 *
 * 置き場所は**サーバーが決めます**（利用者に決めさせない。`upload-slots.ts`）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Number.isInteger(body?.count) ? (body.count as number) : 0;
  if (count < 1 || count > MAX_UPLOAD_SLOTS) {
    return NextResponse.json({ error: "invalid_count" }, { status: 400 });
  }

  const admin = createAdminClient();
  const slots: { path: string; token: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const path = tempUploadPath(user.id);
    const { data, error } = await admin.storage.from(POST_MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "sign_failed" }, { status: 500 });
    }
    slots.push({ path, token: data.token });
  }
  return NextResponse.json({ bucket: POST_MEDIA_BUCKET, slots }, { status: 201 });
}
