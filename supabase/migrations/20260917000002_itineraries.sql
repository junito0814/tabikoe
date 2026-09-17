-- table-catalog-v3 Task2・Task3: しおり（itineraries・itinerary_spots・itinerary_members・itinerary_invitations）
-- 出典: docs/tasks/data-model/table-catalog-v3/02-itineraries-tables.md
--       docs/tasks/data-model/table-catalog-v3/03-itinerary-members-invitations.md
--       要件定義書 v3.0 3.11・5.2・5.3
--
-- 【初心者向け】しおりは旅行（trips）と 1 対 1。メンバーと招待はアルバム（album_members / album_invitations）と
-- 同じ形で、しおり専用に別テーブルを持つ（アルバムのメンバーとは独立に招待するため）。
-- RLS は「自分がメンバーのしおりだけ」を基本にし、招待の受諾だけは security definer 関数で行う。

-- 1. しおり本体
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itineraries_trip_unique unique (trip_id),
  constraint itineraries_period_check check (
    (start_date is null and end_date is null)
    or (start_date is not null and end_date is not null and end_date >= start_date)
  )
);

-- 2. しおりのスポット
create table if not exists public.itinerary_spots (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  -- NULL＝未定。1 始まり（Day 1 = 1）
  day_index integer check (day_index is null or day_index >= 1),
  -- 10 分刻み（分が 0,10,...,50）
  arrival_time time,
  sort_order integer not null default 0,
  memo text,
  checked_at timestamptz,
  checked_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint itinerary_spots_unique unique (itinerary_id, spot_id),
  constraint itinerary_spots_arrival_step_check check (
    arrival_time is null or (extract(minute from arrival_time)::integer % 10 = 0 and extract(second from arrival_time) = 0)
  )
);

create index if not exists itinerary_spots_itinerary_idx on public.itinerary_spots (itinerary_id, day_index, arrival_time, sort_order);
create index if not exists itinerary_spots_spot_idx on public.itinerary_spots (spot_id);

-- 3. メンバー（オーナー／メンバーの 2 段階）
create table if not exists public.itinerary_members (
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (itinerary_id, user_id)
);

create index if not exists itinerary_members_user_idx on public.itinerary_members (user_id);

-- 4. 招待リンク（album_invitations と同じ構造。役割は member 固定なので列を持たない）
create table if not exists public.itinerary_invitations (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  token text not null,
  created_by uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint itinerary_invitations_token_unique unique (token)
);

create index if not exists itinerary_invitations_itinerary_idx on public.itinerary_invitations (itinerary_id);

-- 5. RLS
alter table public.itineraries enable row level security;
alter table public.itinerary_spots enable row level security;
alter table public.itinerary_members enable row level security;
alter table public.itinerary_invitations enable row level security;

-- メンバー判定（itinerary_members 自身のポリシーから参照すると再帰するため security definer）
create or replace function public.is_itinerary_member(p_itinerary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.itinerary_members m
    where m.itinerary_id = p_itinerary_id and m.user_id = auth.uid()
  )
$$;
revoke execute on function public.is_itinerary_member(uuid) from public, anon;
grant execute on function public.is_itinerary_member(uuid) to authenticated, service_role;

drop policy if exists "itineraries_member_select" on public.itineraries;
create policy "itineraries_member_select"
  on public.itineraries for select to authenticated
  using (public.is_itinerary_member(id));

drop policy if exists "itinerary_spots_member_all" on public.itinerary_spots;
create policy "itinerary_spots_member_all"
  on public.itinerary_spots for all to authenticated
  using (public.is_itinerary_member(itinerary_id))
  with check (public.is_itinerary_member(itinerary_id));

drop policy if exists "itinerary_members_select_same" on public.itinerary_members;
create policy "itinerary_members_select_same"
  on public.itinerary_members for select to authenticated
  using (public.is_itinerary_member(itinerary_id));

-- 招待トークンは URL に含まれる秘密なので authenticated には SELECT も与えない
grant all privileges on table public.itineraries, public.itinerary_spots, public.itinerary_members, public.itinerary_invitations to service_role;
grant select on table public.itineraries to authenticated;
grant select, insert, update, delete on table public.itinerary_spots to authenticated;
grant select on table public.itinerary_members to authenticated;

-- 6. 作成時にオーナー行を自動追加（trips_ensure_owner_membership と同じ考え方）
create or replace function public.ensure_itinerary_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.trips where id = new.trip_id;
  if v_owner is not null then
    insert into public.itinerary_members (itinerary_id, user_id, role)
    values (new.id, v_owner, 'owner')
    on conflict (itinerary_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.ensure_itinerary_owner_membership() from public, anon, authenticated;

drop trigger if exists itineraries_ensure_owner_membership on public.itineraries;
create trigger itineraries_ensure_owner_membership
  after insert on public.itineraries
  for each row execute function public.ensure_itinerary_owner_membership();

-- 7. 招待の受諾（service_role からのみ実行。期限・無効化を検証して member 行を追加する）
create or replace function public.accept_itinerary_invitation(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
begin
  select * into v_invitation
    from public.itinerary_invitations
    where token = p_token
      and revoked_at is null
      and expires_at > now();
  if not found then
    return null;
  end if;

  insert into public.itinerary_members (itinerary_id, user_id, role)
  values (v_invitation.itinerary_id, p_user_id, 'member')
  on conflict (itinerary_id, user_id) do nothing;

  return v_invitation.itinerary_id;
end;
$$;
revoke all on function public.accept_itinerary_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_itinerary_invitation(text, uuid) to service_role;

-- 8. 退会時のオーナー継承（アルバムと同じ基準：投稿数最多 > 参加が早い順）。メンバーがいなければしおりを削除
create or replace function public.transfer_itinerary_ownership(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned record;
  v_successor record;
begin
  for v_owned in
    select m.itinerary_id, i.trip_id
      from public.itinerary_members m
      join public.itineraries i on i.id = m.itinerary_id
      where m.user_id = p_user_id and m.role = 'owner'
  loop
    select m.user_id
      into v_successor
      from public.itinerary_members m
      left join (
        select user_id, count(*) as post_count
        from public.posts
        where trip_id = v_owned.trip_id
        group by user_id
      ) p on p.user_id = m.user_id
      where m.itinerary_id = v_owned.itinerary_id
        and m.user_id <> p_user_id
      order by coalesce(p.post_count, 0) desc, m.joined_at asc
      limit 1;

    if found then
      update public.itinerary_members set role = 'owner'
        where itinerary_id = v_owned.itinerary_id and user_id = v_successor.user_id;
      delete from public.itinerary_members
        where itinerary_id = v_owned.itinerary_id and user_id = p_user_id;
    else
      delete from public.itineraries where id = v_owned.itinerary_id;
    end if;
  end loop;
end;
$$;
revoke all on function public.transfer_itinerary_ownership(uuid) from public, anon, authenticated;
grant execute on function public.transfer_itinerary_ownership(uuid) to service_role;

-- 9. 更新日時の自動更新（一覧の並び替えに使う）
create or replace function public.touch_itinerary_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.itineraries set updated_at = now()
    where id = coalesce(new.itinerary_id, old.itinerary_id);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.touch_itinerary_updated_at() from public, anon, authenticated;

drop trigger if exists itinerary_spots_touch_updated_at on public.itinerary_spots;
create trigger itinerary_spots_touch_updated_at
  after insert or update or delete on public.itinerary_spots
  for each row execute function public.touch_itinerary_updated_at();
