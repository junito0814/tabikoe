import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { buildPostCards, POST_CARD_SELECT, type PostCardPage, type PostCardRow } from "@/lib/posts/post-cards";
import { buildMediaPage, mergeMedia, PHOTOS_PAGE_SIZE, type SpotMediaPage, type SpotPostMediaRow } from "@/lib/posts/search-photos";
import { isAscending, type ListSort } from "@/lib/records/list-sort";

/**
 * #954（2026-10-17）: いいねした投稿（SC-34）の読み取り
 * 出典: Issue #954、要件定義書 3.6.6、ワイヤーフレーム決定事項 98
 *
 * 【初心者向け】「♡ を押した順」で並べるのがこの画面の肝です。投稿の新着順ではありません。
 * 投稿の表には「いつ ♡ を押したか」が入っていないので、
 *   1. `likes` から**いいねした順**で `post_id` を取る
 *   2. その投稿を取る（このとき DB の並びは当てにならない）
 *   3. 1 の並びに**戻してから**ページを切る
 * という 3 段で作ります。2 と 3 を逆にすると、2 ページ目で順番が入れ替わります。
 *
 * **出さない投稿**（要件 3.6.6）。いいねしたあとに状態が変わったものは、一覧に出しません。
 *   - 消された投稿 … `likes` ごと消えます（`on delete cascade`）。何もしなくてよい
 *   - 非公開に変えられた投稿 … `visibility != public` で落とす
 *   - 下書きに戻された投稿 … `status != published` で落とす
 *   - 運営が非表示にした投稿 … `hidden_at` で落とす
 *   - ブロックした／された人の投稿 … 相互非表示（要件 3.8.2）
 */

/** いいねを読む上限。これより古いいいねは一覧に出ない（並べ替えをサーバーの集計に頼らないための安全弁） */
export const LIKED_POSTS_FETCH_CAP = 500;

/** 1 ページの件数（スポット別一覧と同じ） */
export const LIKED_POSTS_PAGE_SIZE = 20;

/**
 * いいねした順の `post_id`（純粋関数にはできない＝DB を引くので、ここだけに閉じる）。
 *
 * 【初心者向け】同じ投稿に 2 回いいねはできない（`likes_post_user_unique`）ので、重複は出ません。
 *
 * **`post_id` でも並べているのは、同じ時刻のいいねがあるため。** まとめて押したときや、
 * 開発用のデータを一度に入れたときは `created_at` が同じになります。そのとき順番は DB 任せで、
 * **呼ぶたびに変わることがあります**。1 ページ目と 2 ページ目を別々に取るこの画面では、
 * それだと同じ投稿が 2 回出たり、1 件も出てこなかったりします。
 * 2 つ目の並び（`post_id`）を足すと、同じ時刻でも毎回同じ順になります。
 */
async function findLikedPostIdsInOrder(admin: SupabaseClient, viewerId: string, sort: ListSort): Promise<string[]> {
  const { data, error } = await admin
    .from("likes")
    .select("post_id, created_at")
    .eq("user_id", viewerId)
    .order("created_at", { ascending: isAscending(sort) })
    .order("post_id", { ascending: isAscending(sort) })
    .limit(LIKED_POSTS_FETCH_CAP);
  if (error) throw error;
  return (data ?? []).map((row) => (row as { post_id: string }).post_id);
}

/**
 * いま見られる投稿だけに絞る条件（カードでも写真でも同じ条件を使う）。
 *
 * 【初心者向け】2 か所に同じ条件を書くと、片方だけ直して「一覧には出ないのに写真には出る」
 * という壊れ方をします（約束 14）。`select` だけ変えて、絞り方は 1 つにしておきます。
 */
function visibleLikedPosts(admin: SupabaseClient, select: string, postIds: string[], blockedIds: string[]) {
  const query = admin
    .from("posts")
    .select(select)
    .in("id", postIds)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null);
  return blockedIds.length > 0 ? query.not("user_id", "in", `(${blockedIds.join(",")})`) : query;
}

/** いいねした順に並べ直す（DB から返る順は当てにならない） */
function inLikedOrder<T extends { id: string }>(rows: T[], orderedIds: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return orderedIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/** アカウント画面の行に出す件数（いま見られるものだけ数える。一覧の件数と必ず一致させる） */
export async function countLikedPosts(admin: SupabaseClient, viewerId: string): Promise<number> {
  const postIds = await findLikedPostIdsInOrder(admin, viewerId, "newest");
  if (postIds.length === 0) return 0;
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const { data, error } = await visibleLikedPosts(admin, "id", postIds, blockedIds);
  if (error) throw error;
  return (data ?? []).length;
}

/** SC-34 の「投稿」側。1 ページ分のカードを、いいねした順で返す */
export async function getLikedPostCards(
  admin: SupabaseClient,
  viewerId: string,
  sort: ListSort,
  offset: number,
  limit: number = LIKED_POSTS_PAGE_SIZE
): Promise<PostCardPage> {
  const orderedIds = await findLikedPostIdsInOrder(admin, viewerId, sort);
  if (orderedIds.length === 0) return { posts: [], nextOffset: null };

  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const { data, error } = await visibleLikedPosts(admin, POST_CARD_SELECT, orderedIds, blockedIds);
  if (error) throw error;

  // 並べ直してからページを切る（先に切ると 2 ページ目の順番が狂う）
  const rows = inLikedOrder((data ?? []) as unknown as PostCardRow[], orderedIds);
  const page = rows.slice(offset, offset + limit);
  const posts = await buildPostCards(admin, viewerId, page);
  return { posts, nextOffset: offset + limit < rows.length ? offset + limit : null };
}

/** 写真一覧に出す投稿の列（アルバム写真一覧と同じ並び） */
const LIKED_MEDIA_SELECT =
  "id, created_at, visibility, rating, duration, cost, visit_date, spots(name, source), users(display_name, is_deleted), " +
  "post_photos(id, storage_url, video_url, media_type, display_order, hidden_at)";

/** SC-34 の「写真」側。アルバム写真一覧（SC-21）と同じ作りで、取得元を「いいねした投稿」に変えたもの */
export async function getLikedMediaPage(
  admin: SupabaseClient,
  viewerId: string,
  sort: ListSort,
  offset: number,
  limit: number = PHOTOS_PAGE_SIZE
): Promise<SpotMediaPage> {
  const orderedIds = await findLikedPostIdsInOrder(admin, viewerId, sort);
  if (orderedIds.length === 0) return { items: [], nextOffset: null };

  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const { data, error } = await visibleLikedPosts(admin, LIKED_MEDIA_SELECT, orderedIds, blockedIds);
  if (error) throw error;

  const rows = inLikedOrder((data ?? []) as unknown as (SpotPostMediaRow & { id: string })[], orderedIds);
  // 他人の投稿を見る画面なので、非公開投稿は含めない（アルバムと違う点）
  return buildMediaPage(admin, mergeMedia(rows), offset, limit);
}
