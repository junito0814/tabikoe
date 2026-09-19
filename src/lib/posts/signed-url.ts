import type { SupabaseClient } from "@supabase/supabase-js";
import { POST_MEDIA_BUCKET } from "./constants";

/** 署名付きURLの有効期間（秒）。画面表示中に切れない程度の短さにする。 */
const SIGNED_URL_EXPIRES_IN = 60 * 60;

/**
 * 投稿写真の表示用URLを発行する。
 *
 * post-mediaバケットは非公開のため（非公開投稿の写真がURLだけで取得できないよう
 * 20260908000013で意図的にそうしている）、表示には署名付きURLが必要になる。
 * 呼び出し元は、その投稿を閲覧してよいかを先に判定すること。
 */
export async function createPostPhotoUrls(
  admin: SupabaseClient,
  storagePaths: string[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  // 絶対 URL（http/https）はバケットの外の画像なので署名せずそのまま返す（ダミーデータの picsum など）
  const external = storagePaths.filter((path) => /^https?:\/\//.test(path));
  for (const path of external) urls.set(path, path);
  const bucketPaths = storagePaths.filter((path) => !urls.has(path));
  if (bucketPaths.length === 0) {
    return urls;
  }

  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrls(bucketPaths, SIGNED_URL_EXPIRES_IN);

  if (error || !data) {
    return urls;
  }

  for (const item of data) {
    if (item.path && item.signedUrl) {
      urls.set(item.path, item.signedUrl);
    }
  }

  return urls;
}
