-- #903: よく引く列に索引を足す（スポット別の一覧・カードの写真）
-- 出典: Issue #903「よく引く列に索引が無い（posts.spot_id・post_photos.post_id）」
--
-- 【初心者向け】なぜ自動では付かないのか。
--   PostgreSQL は、外部キー（`posts.spot_id` → `spots.id`）を張っても**索引を自動では作りません**。
--   「その値を指している行を探す」のは毎回の全件走査になります。
--   `post_photos` に至っては索引が 1 本もありませんでした。
--
-- 【初心者向け】なぜ測ってから入れるのか。
--   「索引を足せば速くなる」は思い込みになりがちです。足せば**書き込みは少し遅くなる**ので、
--   効かない索引を増やすのは損です。開発用の Supabase に 6 万件入れて、前後を測りました
--   （道具: scripts/bench-index.mjs）。
--
--   | 問い合わせ                       | 索引なし | 索引あり |
--   |----------------------------------|---------|---------|
--   | スポット別の一覧                  | 52 ms   | 33 ms   |
--   | そのスポットの件数（count）        | 189 ms  | 65 ms   |
--   | カード 20 枚ぶんの写真             | 84 ms   | 34 ms   |
--
--   （中央値・7 回。通信の往復 40〜60ms を含む。6,000 件までは差が出ませんでした）

/*
 * スポット別の投稿一覧（SC-04）。`spot_id` で絞り、新着順に 20 件ずつ出す。
 *
 * 【初心者向け】`where` が付いた索引を「部分索引」と呼びます。公開済みの投稿しか一覧に出さないので、
 * **非公開・下書き・非公開化されたものを索引に入れません**。索引が小さくなり、読むのも速くなります。
 * 条件は load-search-page.ts の問い合わせとそろえてあること（ずれると索引が使われません）。
 */
create index if not exists posts_spot_published_idx
  on public.posts (spot_id, published_at desc)
  where status = 'published' and visibility = 'public' and hidden_at is null;

/*
 * 投稿カードの写真。カード 20 枚ぶんをまとめて引く（`post_id in (...)`）。
 * `display_order` も入れてあるので、並べ替えのために読み直さずに済みます。
 */
create index if not exists post_photos_post_idx
  on public.post_photos (post_id, display_order);
