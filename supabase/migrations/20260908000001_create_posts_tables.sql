-- F-PO-01 Task1: 投稿関連テーブル（trips, spots, posts, post_photos）の作成
-- 出典: docs/tasks/posts/post-creation/01-post-schema-migration.md
--
-- table-catalog（album_members等）・account-deletion（オーナー継承）から
-- trips/posts への参照があるため、先行してこのマイグレーションを適用する。

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  prefecture text,
  source text not null check (source in ('places', 'manual'))
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete restrict,
  category text not null,
  visit_date date,
  duration text,
  cost integer,
  rating integer,
  comment text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  storage_url text,
  video_url text,
  duration_seconds integer,
  display_order integer not null default 0
);

alter table public.trips enable row level security;
alter table public.spots enable row level security;
alter table public.posts enable row level security;
alter table public.post_photos enable row level security;

create policy "trips_owner_all"
  on public.trips
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- spotsはどのユーザーの投稿からも参照される共有マスタのため、閲覧のみ全ユーザーに許可する。
-- 作成・更新はRoute Handlers（Service Role Key）経由で行う想定（F-MP系ストーリーの対象）。
create policy "spots_select_all"
  on public.spots
  for select
  to authenticated
  using (true);

create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (visibility = 'public' or auth.uid() = user_id);

create policy "posts_owner_write"
  on public.posts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "post_photos_select_visible"
  on public.post_photos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id
        and (p.visibility = 'public' or p.user_id = auth.uid())
    )
  );

create policy "post_photos_owner_write"
  on public.post_photos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id and p.user_id = auth.uid()
    )
  );
