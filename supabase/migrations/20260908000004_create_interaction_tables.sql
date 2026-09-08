-- data-model/table-catalog Task5: 対話系テーブル（comments・likes・wishlist・blocks）の作成
-- 出典: docs/tasks/data-model/table-catalog/05-interaction-tables.md
--
-- いずれもF-AC-05（退会）が削除・匿名化の対象として参照する。
-- commentsは退会時も残存させる（投稿者表示のみ匿名化）。likes/wishlist/blocksは退会時に削除する。

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_post_user_unique unique (post_id, user_id)
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_user_spot_unique unique (user_id, spot_id)
);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_blocker_blocked_unique unique (blocker_id, blocked_id)
);

alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.wishlist enable row level security;
alter table public.blocks enable row level security;

drop policy if exists "comments_select_visible_post" on public.comments;
create policy "comments_select_visible_post"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and (p.visibility = 'public' or p.user_id = auth.uid())
    )
  );

drop policy if exists "comments_owner_write" on public.comments;
create policy "comments_owner_write"
  on public.comments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "likes_owner_all" on public.likes;
create policy "likes_owner_all"
  on public.likes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "wishlist_owner_all" on public.wishlist;
create policy "wishlist_owner_all"
  on public.wishlist
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "blocks_owner_all" on public.blocks;
create policy "blocks_owner_all"
  on public.blocks
  for all
  to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);
