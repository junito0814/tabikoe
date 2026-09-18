-- table-catalog-v3 Task1: posts の下書き列追加とカテゴリ 7 値への移行
-- 出典: docs/tasks/data-model/table-catalog-v3/01-posts-draft-category-migration.md
--       要件定義書 v3.0 3.3.1（カテゴリ 7 つ）・3.3.7（下書き）・5.3（下書きの保持・投稿の位置）
--
-- 【初心者向け】v3.0 で投稿に「下書き」という状態が加わる。下書きは必須項目が空でも保存できるため、
-- これまで NOT NULL だった列（spot_id・category など）を「公開（published）のときだけ必須」という
-- CHECK 制約に置き換える。位置（lat/lng）はスポットとは別に投稿自身が持つ（下書きはスポットを作らないため）。

-- 1. 列の追加
alter table public.posts add column if not exists status text not null default 'published';
alter table public.posts add column if not exists lat double precision;
alter table public.posts add column if not exists lng double precision;
alter table public.posts add column if not exists published_at timestamptz;

alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts
  add constraint posts_status_check check (status in ('draft', 'published'));

-- 既存行はすべて公開済みとして扱い、公開日時には作成日時を入れる（新着順の基準を変えない）
update public.posts set published_at = created_at where published_at is null and status = 'published';

-- v1 では訪問日が任意だったため、既存の公開投稿で NULL のものは投稿日（日本時間の日付）で埋める。
-- これを忘れると、下の posts_published_required_check（公開投稿は visit_date 必須）で既存行が違反して失敗する（#418）
update public.posts
  set visit_date = (created_at at time zone 'Asia/Tokyo')::date
  where visit_date is null and status = 'published';

-- 既存投稿の位置はスポットの座標で埋める
update public.posts p
  set lat = s.lat, lng = s.lng
  from public.spots s
  where p.spot_id = s.id and (p.lat is null or p.lng is null);

-- 2. 必須項目を「公開のときだけ必須」にする
alter table public.posts alter column spot_id drop not null;
alter table public.posts alter column category drop not null;

alter table public.posts drop constraint if exists posts_published_required_check;
alter table public.posts
  add constraint posts_published_required_check
  check (
    status = 'draft'
    or (
      spot_id is not null
      and category is not null
      and duration is not null
      and rating is not null
      and visit_date is not null
      and lat is not null
      and lng is not null
      and published_at is not null
    )
  );

-- 3. カテゴリを 7 値に更新し、旧「イベント会場」を「エンタメ・イベント」へ移行する
alter table public.posts drop constraint if exists posts_category_check;
update public.posts set category = 'エンタメ・イベント' where category = 'イベント会場';
alter table public.posts
  add constraint posts_category_check
  check (
    category is null
    or category in (
      'グルメ', '観光スポット', '自然・景勝地', '体験・アクティビティ',
      'エンタメ・イベント', 'ショッピング', '宿泊施設'
    )
  );

-- rating は draft では NULL を許す
alter table public.posts drop constraint if exists posts_rating_check;
alter table public.posts
  add constraint posts_rating_check check (rating is null or (rating >= 1 and rating <= 5));

-- 4. RLS: 下書きは本人にだけ見える。公開投稿の既存ポリシーに status の条件を足す
drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (
    (status = 'draft' and user_id = auth.uid())
    or (
      status = 'published'
      and (hidden_at is null or user_id = auth.uid())
      and public.can_view_post(trip_id, user_id, visibility)
    )
  );

-- 本人が更新できる列に status・lat・lng・published_at を加える（hidden_at 等は引き続き不可）
revoke update on table public.posts from authenticated;
grant update (trip_id, spot_id, category, visit_date, duration, cost, rating, comment, visibility, status, lat, lng, published_at)
  on table public.posts to authenticated;

-- 下書き一覧・公開日時順の取得で使う索引
create index if not exists posts_user_status_idx on public.posts (user_id, status);
create index if not exists posts_published_at_idx on public.posts (published_at desc) where status = 'published';
