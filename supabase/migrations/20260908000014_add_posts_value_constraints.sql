-- F-PO-01 Task3: postsの入力規則をDB制約としても担保する
-- 出典: docs/tasks/posts/post-creation/03-post-creation-handler.md
--       要件定義書3.3.1（入力項目の入力規則・制約）
--
-- 20260908000001でテーブルを作った時点では、category・duration・cost・ratingに
-- 制約を付けていなかった。値の集合が要件定義書で確定しているため、
-- アプリ側のバリデーションに加えてDB側でも弾けるようにする
-- （5.3「RLSも二重の防御線」と同じ考え方で、経路が増えても不正値が入らないようにする）。

alter table public.posts
  drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check
  check (category in ('グルメ', '観光スポット', '体験・アクティビティ', '宿泊施設', 'イベント会場'));

alter table public.posts
  drop constraint if exists posts_duration_check;
alter table public.posts
  add constraint posts_duration_check
  check (duration in ('30分以内', '1時間以内', '2時間以内', '3時間以内', 'それ以上'));

-- 1人あたりの金額（円、整数）。無料は0
alter table public.posts
  drop constraint if exists posts_cost_check;
alter table public.posts
  add constraint posts_cost_check
  check (cost is null or (cost >= 0 and cost <= 999999));

alter table public.posts
  drop constraint if exists posts_rating_check;
alter table public.posts
  add constraint posts_rating_check
  check (rating >= 1 and rating <= 5);
