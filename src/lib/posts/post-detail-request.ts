import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { getPostDetail, type PostDetailData } from "@/lib/posts/post-detail";

/**
 * #964（2026-10-17）: 投稿詳細を **1 リクエストに 1 回だけ**読む口。
 *
 * 【初心者向け】なぜこれが要るか。
 *
 * 存在しない投稿の URL は、画面には「見つかりません」が出るのに **HTTP では 200** を返していました。
 * 原因は**ストリーミング**です。`loading.tsx` の骨組みを先に送り始めた時点で応答のヘッダが
 * 出てしまうので、あとから `notFound()` を呼んでも**ステータスを変えられません**
 * （`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`
 * の「Status Codes」に書いてあります）。
 *
 * 直し方は「**流し始める前に**在るかどうかを確かめる」ことで、流し始める前に動くのは
 * `generateMetadata` です。本番ビルドで実際に試し、`generateMetadata` からの `notFound()` は
 * **404 を返す**ことを確かめました（2026-10-17。手元の `next dev` では 200 のままですが、
 * これは dev が常に流し始めるためで、本番ビルドでは効きます）。
 *
 * ただし素直に書くと、`generateMetadata` と本体で**同じ投稿を 2 回読む**ことになります。
 * そこで React の `cache` で包みます ── 同じリクエストの中で同じ引数なら、
 * **2 回目は問い合わせずに 1 回目の結果を返す**ので、問い合わせの数は増えません
 * （Next.js が勧めている方法。`caching-without-cache-components.md`「Deduplicating requests」）。
 */

/** ログイン中の人（未ログインは null）。1 リクエストに 1 回だけ数える */
export const requestViewerId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const user = await getAuthUserFromClaims(supabase);
  return user?.id ?? null;
});

export type PostDetailResult = {
  post: PostDetailData | null;
  /**
   * 読み込みそのものが失敗したか。
   *
   * 【初心者向け】`post === null` には 2 つの意味があります ──
   * 「**無い**（または見られない）」と「**読めなかった**」。前者は 404 ですが、
   * 後者は「読み込みに失敗しました（取り直す）」を出すところで、404 にしてはいけません。
   * 言い分けないと、DB が一時的に落ちただけで投稿が消えたように見えます。
   */
  failed: boolean;
};

/** 投稿詳細。見られないときは `post: null`。1 リクエストに 1 回だけ読む */
export const loadPostDetailOnce = cache(async (postId: string): Promise<PostDetailResult> => {
  const viewerId = await requestViewerId();
  try {
    return { post: await getPostDetail(createAdminClient(), viewerId, postId), failed: false };
  } catch {
    return { post: null, failed: true };
  }
});
