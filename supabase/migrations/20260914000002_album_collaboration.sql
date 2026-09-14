-- F-RC-03 Task1: album_invitations テーブル、および旅行（アルバム）のオーナー会員行の自動作成
-- 出典: docs/tasks/records/album-collaboration/01-album-invitations-table-migration.md
--       docs/tasks/records/album/01-album-detail-handler.md
--       要件定義書3.6.3・5.2
--
-- これまで trips は投稿時に resolveTripId() が作るだけで、album_members にオーナー行が無かった。
-- アルバム機能（メンバー判定・オーナー継承）は album_members を前提にしているため、
-- trips の INSERT 時にオーナー行を自動作成するトリガーを置き、既存の trips も補完する。

-- 1. 招待テーブル
create table if not exists public.album_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint album_invitations_token_unique unique (token)
);

create index if not exists album_invitations_trip_idx on public.album_invitations (trip_id);

alter table public.album_invitations enable row level security;

-- 招待の発行・無効化・受諾はすべて Route Handlers（service_role）で行う。
-- トークンは URL に含まれる秘密なので authenticated には SELECT も与えない。
grant all privileges on table public.album_invitations to service_role;

-- 2. オーナー会員行の自動作成
create or replace function public.ensure_trip_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.album_members (trip_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.ensure_trip_owner_membership() from public, anon, authenticated;

drop trigger if exists trips_ensure_owner_membership on public.trips;
create trigger trips_ensure_owner_membership
  after insert on public.trips
  for each row execute function public.ensure_trip_owner_membership();

-- 既存の trips を補完する
insert into public.album_members (trip_id, user_id, role)
select t.id, t.user_id, 'owner'
from public.trips t
on conflict (trip_id, user_id) do nothing;

-- 3. メンバー判定関数（RLS から呼ぶ。album_members 自身のポリシーから参照すると再帰するため security definer）
create or replace function public.is_album_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.album_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  )
$$;

-- 戻り値は真偽値のみで、他人の行は露出しない
revoke execute on function public.is_album_member(uuid) from public, anon;
grant execute on function public.is_album_member(uuid) to authenticated, service_role;

-- 4. メンバーは同じアルバムのメンバー一覧と旅行タイトルを参照できる（画面は service_role 経由だが二重防御）
drop policy if exists "album_members_select_same_trip" on public.album_members;
create policy "album_members_select_same_trip"
  on public.album_members
  for select
  to authenticated
  using (public.is_album_member(trip_id));

drop policy if exists "trips_select_member" on public.trips;
create policy "trips_select_member"
  on public.trips
  for select
  to authenticated
  using (public.is_album_member(id));

-- 5. 投稿の閲覧判定（20260914000001）も、旅行のオーナー（trips.user_id）を含める
create or replace function public.can_view_post(p_trip_id uuid, p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
as $$
  select p_visibility = 'public'
      or p_owner_id = auth.uid()
      or public.is_album_member(p_trip_id)
$$;
