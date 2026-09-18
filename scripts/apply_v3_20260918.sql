-- v3.0 マイグレーション 5 本の結合版（Supabase の SQL エディタに貼って 1 回で実行する）
-- 出典: docs/development-process.md（CLI 未導入のため、結合した SQL を SQL Editor で適用する手順）
--
-- 【初心者向け】supabase/migrations/ の 5 ファイルを上から順につないだだけ。中身は各ファイルと同じ。
--   1. 20260917000001_posts_draft_and_category.sql   posts の status/lat/lng/published_at とカテゴリ 7 値
--   2. 20260917000002_itineraries.sql                 しおり系 4 テーブル・RLS・関数
--   3. 20260917000003_spot_status_reports.sql         「まだあった」報告と spot_latest_status ビュー
--   4. 20260917000004_deactivate_user_itineraries.sql 退会時のしおりオーナー継承
--   5. 20260918000001_itinerary_notification_types.sql 通知種別にしおりの 2 種を追加
-- どれも冪等（if not exists / or replace）なので、途中まで適用済みでも再実行してよい。
-- 実行後は scripts/verify_20260917.sql で確認する。テーブルが見えない（PGRST205）場合は末尾の notify を単独で実行する。


-- ============================================================
-- supabase/migrations/20260917000001_posts_draft_and_category.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/20260917000002_itineraries.sql
-- ============================================================

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


-- ============================================================
-- supabase/migrations/20260917000003_spot_status_reports.sql
-- ============================================================

-- table-catalog-v3 Task4: 「まだあった」報告（spot_status_reports）
-- 出典: docs/tasks/data-model/table-catalog-v3/04-spot-status-reports-table.md
--       要件定義書 v3.0 3.5.5・5.2・5.3
--
-- 【初心者向け】スポットごとに「まだあった／無くなっていた」を 1 人 1 件で持つ。
-- 主キーを (spot_id, user_id) にしておくと、同じ人の 2 回目は UPSERT（上書き）で済む。
-- 表示に使うのは「スポットごとの最新 1 件」なので、それを返すビューも用意する。

create table if not exists public.spot_status_reports (
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null check (status in ('still_there', 'gone')),
  reported_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);

create index if not exists spot_status_reports_spot_reported_idx
  on public.spot_status_reports (spot_id, reported_at desc);

alter table public.spot_status_reports enable row level security;

drop policy if exists "spot_status_reports_select_all" on public.spot_status_reports;
create policy "spot_status_reports_select_all"
  on public.spot_status_reports for select to authenticated
  using (true);

drop policy if exists "spot_status_reports_owner_write" on public.spot_status_reports;
create policy "spot_status_reports_owner_write"
  on public.spot_status_reports for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all privileges on table public.spot_status_reports to service_role;
grant select, insert, update, delete on table public.spot_status_reports to authenticated;

-- スポットごとの最新 1 件（投稿一覧・吹き出しの「9月にまだあった」に使う）
create or replace view public.spot_latest_status
with (security_invoker = true)
as
  select distinct on (spot_id)
    spot_id,
    status,
    reported_at
  from public.spot_status_reports
  order by spot_id, reported_at desc;

grant select on public.spot_latest_status to authenticated, service_role;


-- ============================================================
-- supabase/migrations/20260917000004_deactivate_user_itineraries.sql
-- ============================================================

-- table-catalog-v3 Task3（続き）: 退会処理にしおりのオーナー継承を組み込む
-- 出典: docs/tasks/data-model/table-catalog-v3/03-itinerary-members-invitations.md
--       要件定義書 v3.0 3.11.7（オーナーの退会）
--
-- 【初心者向け】deactivate_user() は退会のすべて（アルバムのオーナー継承・いいね等の削除・匿名化）を
-- 1 つのトランザクションで行う関数。ここでは中身を書き直さず、先頭で
-- transfer_itinerary_ownership()（20260917000002）を呼ぶ「ラッパー」に置き換える方が安全なので、
-- 既存の関数を deactivate_user_v1 として残し、新しい deactivate_user がそれを呼ぶ形にする。

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'deactivate_user_v1') then
    alter function public.deactivate_user(uuid) rename to deactivate_user_v1;
  end if;
end $$;

create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- しおりのオーナーを先に移す（旅行のオーナー継承より前でも後でも結果は同じだが、
  -- しおりが削除される場合に notifications を残さないため先に行う）
  perform public.transfer_itinerary_ownership(p_user_id);
  perform public.deactivate_user_v1(p_user_id);
end;
$$;

revoke all on function public.deactivate_user(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;
revoke all on function public.deactivate_user_v1(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_user_v1(uuid) to service_role;


-- ============================================================
-- supabase/migrations/20260918000001_itinerary_notification_types.sql
-- ============================================================

-- itinerary-sharing Task2: しおりの通知種別
-- 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
--       要件定義書 v3.0 3.9.1
--
-- 【初心者向け】notifications.type は CHECK 制約で値を固定している（20260912000001）。
-- しおりの参加（itinerary_joined）・削除（itinerary_member_removed）を足すには制約を作り直す必要がある。
-- related_id には itinerary_id を入れる（アルバムの通知は trip_id だが、しおりは itineraries.id）。

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment',
    'like',
    'album_join',
    'role_change',
    'member_removed',
    'new_owner',
    'report_resolved',
    'itinerary_joined',
    'itinerary_member_removed'
  ));


-- PostgREST のスキーマキャッシュを更新（新しいテーブルが API から見えるようにする）
notify pgrst, 'reload schema';
