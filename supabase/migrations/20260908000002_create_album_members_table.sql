-- data-model/table-catalog Task2: album_members テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/02-album-members-table.md
--
-- F-AC-05（退会時のオーナー継承）・F-RC-03（アルバム共同編集）が参照する。
-- owner/editor/viewerの権限モデル自体はF-RC-03で確立するため、ここではスキーマ定義のみ行う。

create table if not exists public.album_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  constraint album_members_trip_user_unique unique (trip_id, user_id)
);

alter table public.album_members enable row level security;

create policy "album_members_select_own"
  on public.album_members
  for select
  to authenticated
  using (auth.uid() = user_id);
