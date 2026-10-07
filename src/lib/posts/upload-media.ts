"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";

/**
 * #860: 写真をブラウザから Storage へ直接上げる
 * 出典: Issue #860「Bug 5: 4.5MB を超える写真が投稿できない（Vercel が本文を関数に渡さない）」
 *
 * 【初心者向け】流れは 3 つです。
 *   1. サーバーに「◯ 枚上げたい」と聞き、**置き場所と鍵**（署名付き URL）をもらう（本文は数百バイト）
 *   2. その鍵で **Storage へ直接**上げる（**Vercel を通らない**ので大きさの上限が無い）
 *   3. サーバーに「上げました」と**置き場所だけ**を伝える。サーバーが Storage から取って
 *      大きさ・形式を確かめ、EXIF の位置情報を消し、向きを直し、縮小して保存し直す
 *
 * 2 を Vercel に通していたのが元の作りで、**4.5MB を超えると関数に届かず**投稿できませんでした。
 */
export async function uploadPostMedia(files: File[]): Promise<Response> {
  const slotResponse = await fetchWithAuthRedirect("/api/posts/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: files.length }),
  });
  if (!slotResponse.ok) return slotResponse;
  const { bucket, slots } = (await slotResponse.json()) as { bucket: string; slots: { path: string; token: string }[] };

  const storage = createClient().storage.from(bucket);
  for (const [index, file] of files.entries()) {
    const slot = slots[index];
    const { error } = await storage.uploadToSignedUrl(slot.path, slot.token, file);
    if (error) {
      /*
       * ここで失敗するのは、通信が切れたか、バケットの決まり（100MB・jpeg/png/mp4/quicktime）に
       * 合わないものを選んだとき。画面に出す言葉はサーバー側と揃えたいので、同じ形で返す。
       */
      return Response.json({ error: "upload_failed" }, { status: 400 });
    }
  }

  return fetchWithAuthRedirect("/api/posts/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: slots.slice(0, files.length).map((slot) => slot.path) }),
  });
}
