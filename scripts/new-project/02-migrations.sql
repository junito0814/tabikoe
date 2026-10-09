-- #896: 新しい Supabase プロジェクトを作るための SQL（2 / 2）
-- supabase/migrations/ を順につないだもの。**手で編集しない**（node scripts/build-new-project-sql.mjs で作り直す）
--
-- 【初心者向け】使い方:
--   新しいプロジェクトの SQL Editor に、01 から順に貼って実行する。
--   **順番が大事**（先に作った表に、あとから列・権限・ポリシーを足しているため）。
--   途中でエラーが出たらそこで止めて、出た文言をそのまま伝えること。先へ進まない。
--
-- この回に入っているもの（26 本）:
--   20260917000002_itineraries.sql
--   20260917000003_spot_status_reports.sql
--   20260917000004_deactivate_user_itineraries.sql
--   20260918000001_itinerary_notification_types.sql
--   20260919000001_daily_album.sql
--   20260919000002_post_duration_7.sql
--   20260919000003_spots_created_by.sql
--   20260919000004_comment_replies.sql
--   20260919000005_in_app_invitations.sql
--   20260927000001_admin_actions.sql
--   20260927000002_strikes.sql
--   20260927000003_spots_created_at.sql
--   20260927000004_last_active_at.sql
--   20260927000005_admin_notifications.sql
--   20260927000006_user_management.sql
--   20260927000007_moderation_action.sql
--   20260927000008_auto_hide.sql
--   20260927000009_spot_fix_request.sql
--   20260927000010_legal_documents.sql
--   20260929000001_admin_actions_actor.sql
--   20261005000001_spots_place_id.sql
--   20261007000001_announcement_reads.sql
--   20261007000002_announcement_reads_grants.sql
--   20261007000003_itinerary_invite_to_album.sql
--   20261009000001_post_media_bucket_limits.sql
--   20261009000002_avatars_bucket_limits.sql

-- ======================================================================
-- 20260917000002_itineraries.sql
-- ======================================================================
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

-- ======================================================================
-- 20260917000003_spot_status_reports.sql
-- ======================================================================
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

-- ======================================================================
-- 20260917000004_deactivate_user_itineraries.sql
-- ======================================================================
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

-- ======================================================================
-- 20260918000001_itinerary_notification_types.sql
-- ======================================================================
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

-- ======================================================================
-- 20260919000001_daily_album.sql
-- ======================================================================
-- mentoring-7 Task2（v3.1）: 「日常」アルバム
-- 出典: docs/tasks/shared-ui/mentoring-7/02-daily-album.md
--       要件定義書 v3.1 3.3.4・3.6.2・5.3「「日常」アルバム」
--
-- 【初心者向け】アルバム欄を空にして投稿したときの入れ物を、仮タイトル「今日の投稿（M/D）」の旅行から
-- 「日常」（1 人 1 つ、is_daily = true）に変える。
--   1. trips.is_daily 列と「1 人 1 行だけ true」の部分ユニーク索引
--   2. 既存の仮タイトルの旅行を各ユーザーの「日常」へ統合（投稿・下書きの trip_id を付け替え、空になった旅行は削除）
-- 「日常」の名前変更・削除・招待・しおり作成は Route Handlers 側で 400 にする（DB では縛らない）。

-- 1. 列と索引
alter table public.trips add column if not exists is_daily boolean not null default false;
create unique index if not exists trips_daily_per_user_unique on public.trips (user_id) where is_daily;

-- 2. 仮タイトルの旅行を「日常」へ統合
do $$
declare
  r record;
  daily_id uuid;
begin
  -- 仮タイトルの旅行を持つユーザーごとに処理する
  for r in
    select distinct user_id from public.trips where title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$'
  loop
    -- その人の「日常」を探す（is_daily 優先、無ければ title = '日常' を昇格、それも無ければ作る）
    select id into daily_id from public.trips where user_id = r.user_id and is_daily limit 1;
    if daily_id is null then
      select id into daily_id from public.trips where user_id = r.user_id and title = '日常' limit 1;
      if daily_id is not null then
        update public.trips set is_daily = true where id = daily_id;
      else
        insert into public.trips (user_id, title, is_daily) values (r.user_id, '日常', true) returning id into daily_id;
      end if;
    end if;

    -- 仮タイトルの旅行の投稿・下書きを「日常」へ。しおり（itineraries）は仮タイトルには作れないので考慮しない
    update public.posts p
      set trip_id = daily_id
      from public.trips t
      where p.trip_id = t.id
        and t.user_id = r.user_id
        and t.title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$';

    -- 空になった仮タイトルの旅行を削除（album_members はオーナー行だけなので cascade で消える）
    delete from public.trips t
      where t.user_id = r.user_id
        and t.title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$'
        and not exists (select 1 from public.posts p where p.trip_id = t.id);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260919000002_post_duration_7.sql
-- ======================================================================
-- feedback-0919 Task1（v3.2）: 滞在時間を 7 択に
-- 出典: docs/tasks/shared-ui/feedback-0919/01-stay-time.md
--       要件定義書 v3.2 3.3.1・5.3「滞在時間の移行」
--
-- 【初心者向け】選択肢を 30分以内／1時間以内／2時間以内／3時間以内／半日／1日／宿泊 の 7 つにする。
-- 既存の「それ以上」は書き換えない（投稿者の意図を勝手に変えない）ので、CHECK 制約は 7 値＋旧値の 8 値を許す。
-- 新規・編集で 7 値だけを受け付けるのはアプリ側（validate-post-input.ts）の仕事。

alter table public.posts drop constraint if exists posts_duration_check;
alter table public.posts
  add constraint posts_duration_check
  check (duration in ('30分以内', '1時間以内', '2時間以内', '3時間以内', '半日', '1日', '宿泊', 'それ以上'));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260919000003_spots_created_by.sql
-- ======================================================================
-- feedback-0919 Task2（v3.2）: スポット登録バッジ（spots.created_by）
-- 出典: docs/tasks/shared-ui/feedback-0919/02-spot-badge.md
--       要件定義書 v3.2 3.7・5.2・5.3「スポット登録者」
--
-- 【初心者向け】「タビコエだけの場所」（source = 'manual'）を最初に登録した人を spots.created_by に記録し、
-- その件数でスポット登録バッジ（1／3／5／10／20／30／50 件）を判定する。
--   1. 列を追加（退会で users が消えたら NULL にする）
--   2. 既存の manual スポットは「最も古い公開投稿の投稿者」で埋める
--   3. badges の CHECK に spot_registration:<閾値> を足す

-- 1. 列
alter table public.spots add column if not exists created_by uuid references public.users (id) on delete set null;
create index if not exists spots_created_by_idx on public.spots (created_by) where created_by is not null;

-- 2. 既存行の埋め合わせ（manual だけ。places 由来は「登録」ではない）
update public.spots s
  set created_by = p.user_id
  from (
    select distinct on (spot_id) spot_id, user_id
    from public.posts
    where status = 'published' and spot_id is not null
    order by spot_id, created_at asc
  ) p
  where s.id = p.spot_id
    and s.source = 'manual'
    and s.created_by is null;

-- 3. バッジ種別
alter table public.badges drop constraint if exists badges_type_check;
alter table public.badges
  add constraint badges_type_check check (
    badge_type ~ '^prefecture:.+$'
    or badge_type in (
      'post_count:1', 'post_count:10', 'post_count:50', 'post_count:100',
      'like_count:1', 'like_count:10', 'like_count:50', 'like_count:100', 'like_count:200',
      'spot_registration:1', 'spot_registration:3', 'spot_registration:5', 'spot_registration:10',
      'spot_registration:20', 'spot_registration:30', 'spot_registration:50'
    )
  );

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260919000004_comment_replies.sql
-- ======================================================================
-- feedback-0919 Task4（v3.2）: コメントへの返信
-- 出典: docs/tasks/shared-ui/feedback-0919/04-comment-reply.md
--       要件定義書 v3.2 3.5.3・3.9.1・5.2・5.3「コメントの返信」
--
-- 【初心者向け】
--   - parent_id: 返信先のコメント（NULL＝最上位）。返信への返信も「直接の返信先」を入れる
--   - root_id  : そのやり取りの最上位コメント。一覧は「最上位 20 件＋その root_id の返信」で取るので、再帰せずに済む
--   - deleted_at: 返信がある親を消したときの論理削除（「削除されたコメント」の枠を残す）。返信が無ければ物理削除する
--   - 親と同じ投稿でなければならない（トリガーで検証）
--   - 通知種別 comment_replied を追加

alter table public.comments add column if not exists parent_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists root_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists deleted_at timestamptz;
create index if not exists comments_root_idx on public.comments (root_id, created_at) where root_id is not null;
create index if not exists comments_post_top_idx on public.comments (post_id, created_at desc) where parent_id is null;

-- 親と同じ投稿でなければ拒否し、root_id を親から引き継ぐ（親が最上位なら親自身）
create or replace function public.comments_set_root()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    new.root_id := null;
    return new;
  end if;
  select post_id, root_id into parent from public.comments where id = new.parent_id;
  if parent is null then
    raise exception 'parent comment not found';
  end if;
  if parent.post_id <> new.post_id then
    raise exception 'parent comment belongs to another post';
  end if;
  new.root_id := coalesce(parent.root_id, new.parent_id);
  return new;
end $$;

drop trigger if exists comments_set_root on public.comments;
create trigger comments_set_root
  before insert on public.comments
  for each row execute function public.comments_set_root();

-- 通知種別
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed',
    'comment_replied'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260919000005_in_app_invitations.sql
-- ======================================================================
-- feedback-0919 Task6（v3.2）: しおり・アルバムのアプリ内招待
-- 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
--       要件定義書 v3.2 3.6.3・3.11.7・3.9.1・5.2・5.3「アプリ内招待」
--
-- 【初心者向け】招待の行（album_invitations／itinerary_invitations）に「誰宛てか」を足す。
--   - invitee_user_id が NULL   → 従来のリンク招待（token を開いた人が参加）
--   - invitee_user_id が入っている → アプリ内招待（その人だけが受諾・辞退できる。通知で届く）
--   - status: pending（未回答）／accepted／declined／revoked（オーナーが取り消し）
--   - 同じ相手への未回答の招待は 1 件だけ（部分ユニーク索引）
--   - 通知種別 album_invited／itinerary_invited（related_id は招待の id）

alter table public.album_invitations add column if not exists invitee_user_id uuid references public.users (id) on delete cascade;
alter table public.album_invitations add column if not exists status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked'));
alter table public.album_invitations add column if not exists responded_at timestamptz;
create unique index if not exists album_invitations_pending_invitee_unique on public.album_invitations (trip_id, invitee_user_id) where status = 'pending' and invitee_user_id is not null;
create index if not exists album_invitations_invitee_idx on public.album_invitations (invitee_user_id) where invitee_user_id is not null;

alter table public.itinerary_invitations add column if not exists invitee_user_id uuid references public.users (id) on delete cascade;
alter table public.itinerary_invitations add column if not exists status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked'));
alter table public.itinerary_invitations add column if not exists responded_at timestamptz;
create unique index if not exists itinerary_invitations_pending_invitee_unique on public.itinerary_invitations (itinerary_id, invitee_user_id) where status = 'pending' and invitee_user_id is not null;
create index if not exists itinerary_invitations_invitee_idx on public.itinerary_invitations (invitee_user_id) where invitee_user_id is not null;

-- 既存の無効化済みリンクは status も revoked に揃える
update public.album_invitations set status = 'revoked' where revoked_at is not null and status = 'pending';
update public.itinerary_invitations set status = 'revoked' where revoked_at is not null and status = 'pending';

-- 通知種別
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260927000001_admin_actions.sql
-- ======================================================================
-- user-management Task 4: 操作の記録（admin_actions）
-- 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
--       要件定義書 3.10.12「操作の記録」（管理者の操作と自動処理を残す。消せない）
--
-- 【初心者向け】operation_logs（要件 7.5）は「利用者の操作」の監査ログで 90 日で消す前提。
-- こちらは「管理者が誰に何をしたか」「自動処理が何をしたか」を人が読める形で残す台帳で、
-- 後から説明できるように **UPDATE・DELETE をどの役割にも許さない**（INSERT と SELECT だけ）。
-- GRANT で塞いだうえで、テーブルの所有者（postgres）が触っても止まるようトリガーでも拒否する。
-- actor_id が NULL の行は「自動」（自動非公開・仮停止など）。

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  -- 誰が。NULL は自動処理。退会で users が消えても記録は残す（set null）
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  -- 何に。target_type は 'post' | 'comment' | 'spot' | 'trip' | 'user' | 'report' | 'announcement' | 'legal_document' など
  target_type text,
  target_id uuid,
  -- 一覧に出す言い方（例: 投稿「たこ焼き〇〇の感想」（はなこ））。対象が消えても読めるように文字で持つ
  target_label text,
  -- 理由（管理者のメモ。自動処理は判定の内容）
  note text,
  created_at timestamptz not null default now(),
  constraint admin_actions_action_check check (
    action in (
      'report_hide',
      'report_delete',
      'report_no_issue',
      'auto_hide',
      'strike_add',
      'strike_revoke',
      'user_suspend',
      'user_provisional_suspend',
      'user_confirm_suspension',
      'user_unsuspend',
      'hidden_restore',
      'spot_fix_request',
      'announcement_create',
      'announcement_update',
      'announcement_delete',
      'legal_publish'
    )
  )
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_actor_id_idx on public.admin_actions (actor_id);
create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;

-- 閲覧は管理者だけ（operation_logs と同じ判定）
drop policy if exists "admin_actions_select_admin" on public.admin_actions;
create policy "admin_actions_select_admin"
  on public.admin_actions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 書き込みは Route Handler が service_role で行う。UPDATE・DELETE・TRUNCATE は誰にも許さない
revoke all privileges on table public.admin_actions from anon, authenticated, service_role;
grant select on table public.admin_actions to authenticated;
grant select, insert on table public.admin_actions to service_role;

-- 所有者が直接 SQL を打っても消せないように、トリガーでも拒否する
create or replace function public.admin_actions_reject_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_actions は書き換え・削除できません（要件定義書 3.10.12）';
end;
$$;

drop trigger if exists admin_actions_no_update on public.admin_actions;
create trigger admin_actions_no_update
  before update or delete on public.admin_actions
  for each row execute function public.admin_actions_reject_change();

-- ======================================================================
-- 20260927000002_strikes.sql
-- ======================================================================
-- strike-system Task 1: ストライクのデータ
-- 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md
--       要件定義書 3.10.7「ストライク制」・3.10.8「自動で行う対応」
--
-- 【初心者向け】ストライク＝「管理者が非公開化・削除を確定した」という違反の記録。通報の件数では付かない。
--   1. strikes … 1 行が 1 ストライク。90 日で失効（expires_at）、管理者が取り消せる（revoked_at）
--   2. users.posting_restricted_until … 投稿・コメント禁止の解除日時（有効 2 で 3 日、3 で 7 日、4 で 30 日）
--      users.suspension_kind … 停止の種類。'provisional'（自動の仮停止）／'confirmed'（管理者が確定・手動停止）
--      停止そのものは既存の suspended_at で表す（proxy.ts の判定はそのまま）
--   3. moderation_settings … しきい値。コードに直書きせず、ここを読む（値を変えるときにデプロイが要らない）

-- 1. strikes
create table if not exists public.strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- どの通報の対応で付いたか（通報が消えても記録は残す）
  report_id uuid references public.reports (id) on delete set null,
  -- 通報の理由（reports.reason と同じ値）
  reason text not null,
  -- 何をしたか（'hide' | 'delete'）
  action text not null,
  -- 対象の言い方（例: 感想「…」）。対象が消えても本人に説明できるように文字で持つ
  target_label text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.users (id) on delete set null,
  revoke_note text,
  constraint strikes_action_check check (action in ('hide', 'delete'))
);

create index if not exists strikes_user_created_idx on public.strikes (user_id, created_at desc);

alter table public.strikes enable row level security;

-- 本人は自分の分を読める（SC-28 アカウントの状態）。管理者は全員分
drop policy if exists "strikes_select_own_or_admin" on public.strikes;
create policy "strikes_select_own_or_admin"
  on public.strikes
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user());

-- 書き込みは Route Handler が service_role で行う（本人が消せてはいけない）
grant all privileges on table public.strikes to service_role;
grant select on table public.strikes to authenticated;

-- 2. users の列
alter table public.users add column if not exists posting_restricted_until timestamptz;
alter table public.users add column if not exists suspension_kind text;
alter table public.users drop constraint if exists users_suspension_kind_check;
alter table public.users add constraint users_suspension_kind_check
  check (suspension_kind is null or suspension_kind in ('provisional', 'confirmed'));
-- 本人の UPDATE は display_name・avatar_url に限っている（20260908000008）ので、この 2 列は自動的に守られる

-- 3. しきい値
create table if not exists public.moderation_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.moderation_settings enable row level security;

drop policy if exists "moderation_settings_select_admin" on public.moderation_settings;
create policy "moderation_settings_select_admin"
  on public.moderation_settings
  for select
  to authenticated
  using (public.is_admin_user());

grant all privileges on table public.moderation_settings to service_role;
grant select on table public.moderation_settings to authenticated;

-- 初期値（要件 3.10.7・3.10.8）。既にあれば触らない
insert into public.moderation_settings (key, value) values
  ('auto_hide_reporters', '3'),            -- 異なる通報者が何人で自動非公開か
  ('unreliable_reporter_no_issue', '3'),   -- 直近 90 日に「問題なし」が何件以上の通報者を数えないか
  ('strike_expiry_days', '90'),            -- ストライクの失効までの日数
  ('strikes_to_suspend', '5'),             -- 何個で仮停止か
  ('restriction_days', '[0, 3, 7, 30]')    -- 有効 1・2・3・4 個のときの投稿禁止日数（0 は警告だけ）
on conflict (key) do nothing;

-- ======================================================================
-- 20260927000003_spots_created_at.sql
-- ======================================================================
-- admin-shell-dashboard Task 2: spots.created_at（ダッシュボードの「最近のスポット」用）
-- 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
--       要件定義書 3.10.3
--
-- 【初心者向け】spots には作った日時が無く、「最近のスポット」「今週のスポット」を出せなかった。
-- 列を足し、既存の行はそのスポットへの最初の投稿の日時で埋める（投稿が無ければ now()）。

alter table public.spots add column if not exists created_at timestamptz not null default now();

update public.spots s
set created_at = p.first_post_at
from (
  select spot_id, min(created_at) as first_post_at
  from public.posts
  group by spot_id
) p
where p.spot_id = s.id;

create index if not exists spots_created_at_idx on public.spots (created_at desc);

-- ======================================================================
-- 20260927000004_last_active_at.sql
-- ======================================================================
-- admin-shell-dashboard Task 3: 最終利用日（users.last_active_at）
-- 出典: docs/tasks/admin/admin-shell-dashboard/03-last-active.md
--       要件定義書 3.10.3「使った人（今日／今週）」・7.4
--
-- 【初心者向け】「今日／今週に使った人」を数えるための列。本人は users を display_name・avatar_url しか
-- 更新できない（20260908000008）ので、値は本人が直接書くのではなく、下の関数 touch_last_active() を
-- 「ログイン中の本人の行に now() を入れるだけ」の窓口として呼ぶ（security definer）。
-- 呼ぶ回数は関所（src/proxy.ts）が Cookie で 1 人 1 日 1 回に抑える。

alter table public.users add column if not exists last_active_at timestamptz;
create index if not exists users_last_active_at_idx on public.users (last_active_at desc);

create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.users set last_active_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated, service_role;

-- ======================================================================
-- 20260927000005_admin_notifications.sql
-- ======================================================================
-- admin-shell-dashboard Task 4: 管理者への通知（通知の種類を 3 つ足す）
-- 出典: docs/tasks/admin/admin-shell-dashboard/04-admin-notifications.md
--       要件定義書 3.9.1「管理者への通知」
--
-- 【初心者向け】通知の種類は notifications.type の CHECK 制約で固定している（20260912000001 以降、足すたびに作り直す）。
--   admin_report      … 新しい通報（related_id = 通報 ID）
--   admin_auto_hidden … 投稿が自動で非公開になった（related_id = 投稿／コメント ID。#553 が作る）
--   admin_suspended   … 仮停止した（related_id = 利用者 ID。#556 が作る）
-- 送り先は is_admin = true の利用者全員。

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260927000006_user_management.sql
-- ======================================================================
-- user-management Task 2: 停止と解除・投稿の一括非公開・ストライクの取り消し
-- 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
--       要件定義書 3.10.9「利用者の管理」、3.9.1「本人への通知」
--
-- 【初心者向け】
--   1. posts.hidden_reason … なぜ非公開になったか。'moderation'（通報対応）／'suspension'（停止に伴う一括非公開）。
--      停止を解除したとき「停止で隠した分だけ」を戻せるように印を残す。自動非公開は #553 で別の列（auto_hidden_at）
--   2. 通知の種類に account_suspended / account_unsuspended（本人向け。related_id は本人の ID）

alter table public.posts add column if not exists hidden_reason text;
alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260927000007_moderation_action.sql
-- ======================================================================
-- strike-system Task 2: 本人への通知（moderation_action）
-- 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
--       要件定義書 3.9.1「本人への通知」（非公開化・削除・ストライク・投稿禁止のたびに理由を知らせる）
--
-- related_id は strikes.id（何を・なぜ・どの措置かは strikes の行から引く）

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260927000008_auto_hide.sql
-- ======================================================================
-- strike-system Task 3: 自動非公開（異なる通報者 3 人）
-- 出典: docs/tasks/safety/strike-system/03-auto-hide.md
--       要件定義書 3.10.8「自動で行う対応」・3.8.1
--
-- 【初心者向け】タスク文書では auto_hidden_at という別の列を足す案だったが、hidden_at を見て隠している場所が
-- 20 か所以上（RLS を含む）あり、全部に or 条件を足すと漏れが出る。そこで「隠す」のは今までどおり hidden_at、
-- 「誰の判断か」は hidden_reason で区別する（'auto' ＝ 自動。'moderation' ＝ 通報対応、'suspension' ＝ 停止）。
-- 「問題なし」で戻すときは hidden_reason = 'auto' の行だけ hidden_at を消す。コメントにも同じ列を足す。

alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

alter table public.comments add column if not exists hidden_reason text;
alter table public.comments drop constraint if exists comments_hidden_reason_check;
alter table public.comments add constraint comments_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

create index if not exists posts_hidden_reason_idx on public.posts (hidden_reason) where hidden_reason is not null;
create index if not exists comments_hidden_reason_idx on public.comments (hidden_reason) where hidden_reason is not null;

-- ======================================================================
-- 20260927000009_spot_fix_request.sql
-- ======================================================================
-- strike-system Task 6: スポットの修正依頼（通知の種類 spot_fix_request）
-- 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
--       要件定義書 3.10.6「スポット情報の誤り」・3.10.13
--
-- related_id はスポット ID（タップで /spots/[id]/edit を開く）。管理者のメモは admin_actions（spot_fix_request）の note から引く

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action',
    'spot_fix_request'
  ));

notify pgrst, 'reload schema';

-- ======================================================================
-- 20260927000010_legal_documents.sql
-- ======================================================================
-- legal-documents Task 1: 規約のデータ（legal_documents・user_consents）と初期の本文
-- 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
--       要件定義書 3.10.11「規約管理」・7.4
--
-- 【初心者向け】「同意した」という事実は、**何に**同意したかが分からなければ意味が無い。だから本文に版を持ち、
-- 同意の記録（user_consents）に版を残す。公開中の版は誰でも読める（未ログインの同意画面から読むため）。
-- 下記の初期データ（利用規約 1.0・個人情報保護方針 1.0）は **素案**。文面の最終確認は運営者が行うこと。

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  -- 利用者に見せる「変更の要点」（1〜3 行）
  summary text not null default '',
  -- 本文（Markdown）
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  published_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_kind_version_unique unique (kind, version)
);

create index if not exists legal_documents_kind_status_idx on public.legal_documents (kind, status);

alter table public.legal_documents enable row level security;

-- 公開中・過去の版は誰でも読める（下書きは管理者だけ）
drop policy if exists "legal_documents_select_published" on public.legal_documents;
create policy "legal_documents_select_published"
  on public.legal_documents
  for select
  to anon, authenticated
  using (status <> 'draft' or public.is_admin_user());

grant all privileges on table public.legal_documents to service_role;
grant select on table public.legal_documents to anon, authenticated;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  agreed_at timestamptz not null default now(),
  constraint user_consents_unique unique (user_id, kind, version)
);

create index if not exists user_consents_user_idx on public.user_consents (user_id, kind);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own" on public.user_consents;
create policy "user_consents_select_own"
  on public.user_consents
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user());

-- 書き込みは Route Handler が service_role で行う（本人が勝手に「同意済み」を作れないように）
grant all privileges on table public.user_consents to service_role;
grant select on table public.user_consents to authenticated;

-- 初期データ（素案）。既にあれば触らない
insert into public.legal_documents (kind, version, summary, body, status, published_at) values
(
  'terms', '1.0', '最初の版です。',
  $terms$# タビコエ 利用規約

この利用規約（以下「本規約」）は、タビコエ（以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用するものとします。

## 第1条（適用）

本規約は、本サービスの利用に関する運営者と利用者との一切の関係に適用されます。

## 第2条（アカウント）

1. 本サービスの利用には Google アカウントによる登録が必要です。
2. 利用者は自分のアカウントを適切に管理し、第三者に使わせてはなりません。
3. 退会すると、投稿・コメント・アルバムなどは投稿者名を伏せた形で残る場合があります。

## 第3条（投稿）

1. 利用者は、自分が訪れた場所についての写真・動画・感想などを投稿できます。
2. 投稿の著作権は投稿者に帰属します。ただし、運営者は本サービスの提供・宣伝のために必要な範囲で投稿を表示・複製できるものとします。
3. 位置情報は、利用者が地図で合わせたピンの座標を保存します。自宅など、公開すると困る場所を投稿しないよう注意してください。

## 第4条（禁止事項）

利用者は、次の行為をしてはなりません。

- 他人の個人情報（住所・電話番号・氏名など）を掲載すること
- 他人になりすますこと
- 虚偽の情報を投稿すること
- 著作権・肖像権など他人の権利を侵害すること
- スパム・宣伝を目的とした投稿やコメント
- 不適切な表現（誹謗中傷・差別・わいせつな内容など）
- 本サービスの運営を妨げること

## 第5条（通報と対応）

1. 利用者は、本規約に反する投稿・コメント・アカウントを通報できます。
2. 運営者は、通報された内容を確認し、非公開化・削除・アカウントの停止などの対応を行うことがあります。
3. 通報が一定数重なった投稿・コメントは、運営者が確認するまで自動的に非公開になることがあります。

## 第6条（違反の記録と制限）

1. 運営者が非公開化または削除を確定した場合、投稿者に違反の記録（ストライク）が 1 つ付きます。記録は付与から 90 日で失効します。
2. 有効な記録の数に応じて、次の制限を行います。1 つ目：警告、2 つ目：3 日間の投稿・コメント禁止、3 つ目：7 日間の投稿・コメント禁止、4 つ目：30 日間の投稿・コメント禁止、5 つ目：アカウントの停止。
3. 個人情報の掲載・なりすましは、1 回でアカウントの停止となることがあります。
4. 制限中も、閲覧・保存・しおりの機能は使えます。自分の状態はマイページの「アカウントの状態」で確認できます。

## 第7条（サービスの変更・停止）

運営者は、事前の通知なく本サービスの内容を変更し、または提供を停止することがあります。

## 第8条（免責）

1. 本サービスの投稿は利用者の主観に基づくものであり、運営者はその正確性を保証しません。
2. 本サービスの利用によって利用者に生じた損害について、運営者は故意または重大な過失がある場合を除き責任を負いません。

## 第9条（規約の変更）

運営者は本規約を変更することがあります。変更後の規約は本サービス上で公開し、利用者には次に本サービスを開いたときに改めて同意を求めます。

## 第10条（準拠法）

本規約は日本法に準拠します。
$terms$,
  'published', now()
),
(
  'privacy', '1.0', '最初の版です。',
  $privacy$# タビコエ 個人情報保護方針

タビコエ（以下「本サービス」）は、利用者の個人情報を次のとおり取り扱います。

## 1. 取得する情報

- Google アカウントの情報（メールアドレス・表示名・プロフィール画像）
- 利用者が登録・投稿した情報（表示名・アイコン・投稿・コメント・保存・しおり・アルバム）
- 投稿の位置情報（利用者が地図で合わせたピンの座標。端末の位置情報そのものは保存しません）
- 最終利用日（1 日 1 回だけ記録します）
- 違反の記録（ストライク。付与から 90 日で失効しますが、運営者の操作の記録には残ります）
- 通報の内容と、通報への対応の記録
- 利用状況の記録（ログイン・投稿・通報などの操作ログ。90 日で消します）

## 2. 利用の目的

- 本サービスの提供・運営・改善のため
- 利用者への通知（コメント・いいね・招待・運営からのお知らせ・違反への対応など）のため
- 不正・違反行為への対応と、本サービスの安全を保つため
- 利用状況の把握（利用者数・使った人の数など）のため

## 3. 第三者への提供

法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供しません。ただし、本サービスの提供に必要な範囲で、次の事業者に情報を預けます。

- Supabase（データベース・認証・画像の保管）
- Google（アカウント認証・地図）
- Vercel（アプリケーションの配信）

## 4. 位置情報

「近くのスポットを探す」「ここを投稿」「地図」を使うときに、端末の位置情報を利用します。許可は端末の標準の確認画面で行い、拒否しても行き先の入力などで代わりの操作ができます。

## 5. 公開範囲

公開設定の投稿は、本サービスの利用者全員に表示されます。非公開設定の投稿・下書きは本人（およびアルバムのメンバー）以外に表示しません。

## 6. 退会と削除

退会すると、アカウントの情報は削除または匿名化されます。投稿・コメントは投稿者名を伏せた形で残る場合があります。

## 7. 同意の記録

新規登録時に本方針と利用規約への同意を記録します。どの版にいつ同意したかを保持し、新しい版を公開したときは改めて同意を求めます。

## 8. お問い合わせ

個人情報の取り扱いに関するお問い合わせは、運営者までご連絡ください。

## 9. 方針の変更

本方針は変更することがあります。変更後の方針は本サービス上で公開します。
$privacy$,
  'published', now()
)
on conflict (kind, version) do nothing;

-- ======================================================================
-- 20260929000001_admin_actions_actor.sql
-- ======================================================================
-- user-management Task 4 の修正（#585）: 管理者として操作した利用者を削除できるようにする
-- 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
--       要件定義書 3.10.12「操作の記録」・5.3「操作の記録の保護」
--
-- 【初心者向け】admin_actions.actor_id は「利用者が消えたら NULL にする」（on delete set null）設定なのに、
-- その NULL 化（UPDATE）を同じテーブルの「書き換え禁止」トリガーが止めていたため、
-- **管理者として 1 度でも操作した利用者を物理削除できなかった**。
--
-- 直し方は 2 つ:
--   1. トリガーで「外部キーによる actor_id の NULL 化だけ」を通す（ほかの列が 1 つでも変われば今までどおり拒否）
--   2. 誰がやったかが NULL で失われないよう、**書き込み時に管理者の表示名も文字で持つ**（actor_label）。
--      対象を target_label で文字に残しているのと同じ考え方。台帳は他のテーブルの都合で読めなくなってはいけない
--      これで「actor_label が無い＝自動処理」「actor_label があって actor_id が NULL ＝退会した管理者」と区別できる

alter table public.admin_actions add column if not exists actor_label text;

-- 既存行を埋めるあいだだけトリガーを外す（このマイグレーションは所有者として実行される）
drop trigger if exists admin_actions_no_update on public.admin_actions;

update public.admin_actions a
set actor_label = u.display_name
from public.users u
where u.id = a.actor_id and a.actor_label is null;

-- 一度きりの片付け: 2026-09-29 の実機通し確認で入った行を消す（note が [E2E] で始まるもの）。
-- 台帳は消せない作りなので、ここでしか消せない。以降このような削除は行わない
delete from public.admin_actions where note like '[E2E]%';

create or replace function public.admin_actions_reject_change()
returns trigger
language plpgsql
as $$
begin
  -- 外部キー（actor_id の on delete set null）による書き換えだけは通す。
  -- ほかの列が 1 つでも変わっていれば拒否する
  if tg_op = 'UPDATE'
     and old.actor_id is not null
     and new.actor_id is null
     and to_jsonb(new) - 'actor_id' = to_jsonb(old) - 'actor_id' then
    return new;
  end if;
  raise exception 'admin_actions は書き換え・削除できません（要件定義書 3.10.12）';
end;
$$;

create trigger admin_actions_no_update
  before update or delete on public.admin_actions
  for each row execute function public.admin_actions_reject_change();

-- ======================================================================
-- 20261005000001_spots_place_id.sql
-- ======================================================================
-- #700: spots に place_id を足す（Google から保存してよい唯一の値）
-- 出典: 要件定義書 6.2「Google から借りるものの方針」、#690 の調査（PR #698）
--
-- 【初心者向け】Google Maps Platform の規約は、業者名・住所・クチコミをコピーして
-- 保存することを禁じている（本文 §3.2.3 (a)(iii)）。例外は Service Specific Terms §3 の
-- 「ID 値」だけで、place_id がそれにあたる。
--
-- place_id があると、営業時間や公式サイトを**その場で**引ける（保存しないで済む）。
-- #701 がこの列を鍵として使う。
--
-- NULL を許すのは次の 2 つがあるため。
--   1. 利用者が自分で登録した場所（source='manual'）には Google の ID が無い
--   2. この列を足す前に登録されたスポット（次に登録されるときまで NULL のまま）

alter table public.spots add column if not exists place_id text;

comment on column public.spots.place_id is
  'Google Places の Place ID。Google から保存してよい唯一の値（Service Specific Terms §3）。手動登録と、この列より前に作られたスポットは NULL';

-- #701 が place_id から引くときに使う。NULL の行は入れない（部分索引）
create index if not exists spots_place_id_idx on public.spots (place_id) where place_id is not null;

-- ======================================================================
-- 20261007000001_announcement_reads.sql
-- ======================================================================
-- #754: 運営からのお知らせにも「読んだかどうか」を持たせる
--
-- ⚠ このファイルには **権限（grant）の書き忘れ** がありました。
--   そのままだと表は出来るのに誰も読み書きできません（permission denied）。
--   直しは 20261007000002_announcement_reads_grants.sql にあります。**両方当ててください。**
-- 出典: Issue #754「Bug 1: 運営からのお知らせに未読・既読が無い」
--       要件定義書 3.9.2（通知一覧）
--
-- 【初心者向け】個人向け通知（notifications）は **1 人に 1 行**あるので、その行に
-- `is_read` を持てた。いっぽうお知らせ（system_announcements）は **1 件を全員で共有**する
-- 作りで（宛先の列を持たない）、1 人が読んでも他の人の既読にできない。
--
-- そこで「**誰がどのお知らせを読んだか**」だけを持つ表を足す。
--   - 未読 ＝ この表に自分の行が**無い**こと
--   - 読んだら 1 行入れる／未読に戻すなら消す（is_read の true/false と同じ意味になる）

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

comment on table public.announcement_reads is
  '#754: 運営からのお知らせを誰が読んだか。行があれば既読、無ければ未読。system_announcements は全員で 1 行を共有するため、既読だけを別に持つ';

-- 「自分が読んだお知らせ」を引くので、user_id から辿る索引を足す（主キーは announcement_id が先頭）
create index if not exists announcement_reads_user_idx on public.announcement_reads (user_id);

alter table public.announcement_reads enable row level security;

-- 自分の既読だけを読み書きできる（他人が読んだかは分からない）
drop policy if exists announcement_reads_select_own on public.announcement_reads;
create policy announcement_reads_select_own on public.announcement_reads
  for select using (auth.uid() = user_id);

drop policy if exists announcement_reads_insert_own on public.announcement_reads;
create policy announcement_reads_insert_own on public.announcement_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists announcement_reads_delete_own on public.announcement_reads;
create policy announcement_reads_delete_own on public.announcement_reads
  for delete using (auth.uid() = user_id);

/*
 * 【初心者向け】ここからは**今いる利用者のための後始末**。
 *
 * この表を足した瞬間、**過去のお知らせがすべて未読**として積み上がります。
 * 昨日から使っている人にも「未読 12 件」と出てしまい、身に覚えがありません。
 *
 * 決めたこと（2026-10-06）: **「自分が登録した日より前に公開されたお知らせは読んだことにする」**。
 * 登録より前のものは、そもそもその人に向けて出したものではないためです。
 */
insert into public.announcement_reads (announcement_id, user_id, read_at)
select a.id, u.id, now()
from public.system_announcements a
join public.users u on a.published_at < u.created_at
on conflict do nothing;

-- ======================================================================
-- 20261007000002_announcement_reads_grants.sql
-- ======================================================================
-- #754 の直し: announcement_reads に権限を渡し忘れていた
--
-- 【初心者向け】何が起きたか。
--   20261007000001 で表は出来たのに、**誰も読み書きできませんでした**
--   （`permission denied for table announcement_reads`）。
--
--   ふつうの Supabase なら、新しく作った表には既定で権限が付きます。
--   ところがこのプロジェクトは 20260908000008（harden_privileges）と 20260908000012 で
--   **その既定を外しています**（匿名の鍵だけで他人のアカウントを消せた・自分を管理者にできた、
--   という実際の穴をふさぐため）。その代わりに、**表を 1 つ作るたびに書く**約束になっています。
--   私はそれを書き忘れました。strikes（20260927000002 の 46-47 行）が見本です。
--
-- 誰に何を渡すか
--   - service_role … 全部。既読を付ける／外すのは Route Handler（サーバー側）だけが行う
--   - authenticated … select だけ。未読の数を数えるのに、利用者の鍵で件数を引くため
--     （何件読んだかを数えるだけ。RLS で自分の行しか見えない）
--   書き込みは利用者の鍵では行わないので、insert / delete は渡しません。

grant all privileges on table public.announcement_reads to service_role;
grant select on table public.announcement_reads to authenticated;

-- 書き込みの権限を渡さないので、insert / delete の RLS は働きようがありません。
-- 「ポリシーがあるのに書けない」は読む人を迷わせるので外します
-- （書き込みは service_role が行い、service_role は RLS を通りません）。
drop policy if exists announcement_reads_insert_own on public.announcement_reads;
drop policy if exists announcement_reads_delete_own on public.announcement_reads;

-- ======================================================================
-- 20261007000003_itinerary_invite_to_album.sql
-- ======================================================================
-- #869: しおりの招待で「アルバムにも招待する」を選べるようにする
--
-- 【初心者向け】なぜ列が要るのか。
--   しおりに招待された人が「参加する」を押したとき、**アルバムにも入れるかどうか**は
--   送った人が決めたことです。押した時点ではもう送信画面は無いので、
--   **招待の行に覚えておく**必要があります。
--
-- 既定は true（アルバムにも招待する）。要件定義書 3.11.7 のとおり、
-- 送信画面のチェックは最初から入っていて、外せばしおりだけになります。
--
-- 【初心者向け】`not null default true` にしてあるので、**この列を当てる前に作られた
-- 招待の行**も自動で true になります（＝今までどおり送ったものはアルバムにも入る）。
alter table public.itinerary_invitations
  add column if not exists invite_to_album boolean not null default true;

comment on column public.itinerary_invitations.invite_to_album is
  '#869: 受諾時に同じ旅行のアルバムにも editor として加えるか。送信時にオーナーが決める（既定 true）';

-- ======================================================================
-- 20261009000001_post_media_bucket_limits.sql
-- ======================================================================
-- #896: post-media バケットの「大きさ上限」と「受け付ける形式」をマイグレーションに書き起こす
-- 出典: Issue #896「開発用の Supabase を本番から分ける」
--       要件定義書 5.4（写真は 10MB・JPEG/PNG、動画は 100MB・MP4/MOV）
--
-- 【初心者向け】なぜ後から足すのか。
--   この 2 つの設定は、これまで**Supabase の管理画面で手作業**で入れられていた。
--   表の形（列や制約）と違って、バケットの設定は SQL を書かなくても画面から変えられるので、
--   つい手で済ませてしまい、**コードに残らなかった**。
--
--   その結果どうなるか: 新しい Supabase プロジェクトを作ってマイグレーションを全部流しても、
--   **このバケットだけ設定が違うもの**ができる。開発では 100MB の動画が上がるのに本番では弾かれる、
--   あるいはその逆、という「手元では動くのに本番で動かない」の典型が生まれる。
--
--   `update` にしてあるのは、バケットは 20260908000013 で既に作られているため。
--   本番にも当てるが、本番は既にこの値なので**何も変わらない**（差分を無くすためだけの一手）。
--
-- 値の根拠（要件定義書 5.4）:
--   - 100MB … 動画 1 点あたりの上限。写真の 10MB はアプリ側（Route Handlers）で見る
--   - 4 形式 … 写真は JPEG / PNG、動画は MP4 と iPhone 標準カメラの MOV（video/quicktime）
update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
where id = 'post-media';

-- ======================================================================
-- 20261009000002_avatars_bucket_limits.sql
-- ======================================================================
-- #896: avatars バケットは「バケット側では制限しない」という判断を書き残す
-- 出典: Issue #896「開発用の Supabase を本番から分ける」
--
-- 【初心者向け】なぜ「何もしない」のに SQL を書くのか。
--   post-media には 100MB・4 形式という制限が入っているのに、avatars には入っていません。
--   コードを読んだ人は「**付け忘れなのか、わざとなのか**」が分かりません。
--   ここに書いておけば、次に読む人が迷いません（約束 16: 決定には理由を書く）。
--
-- なぜバケット側で制限しないのか:
--   アイコンは **Route Handler（/api/users/me/avatar）を通してしか保存されません**。
--   ブラウザから Storage へ直接上げる道（署名付き URL）は、写真と違って用意していません。
--   そしてその Route Handler が、保存する前に src/lib/image/process-upload.ts で
--     - 10MB を超えていないか
--     - 中身が本当に JPEG か PNG か（拡張子ではなく実体を sharp で見る）
--   を確かめ、通らなければ 400 で断ります。つまり**アプリ側で既に守られています**。
--
--   バケット側にも同じ制限を足せば二重の守りになりますが、**本番の設定を変えることになる**ため、
--   ここでは現状（制限なし）をそのまま書き写すに留めます。足すかどうかは別途判断する。
--
-- null を入れるのは「Supabase の既定（プロジェクト全体の上限に従う／形式を問わない）」の意味。
-- 既にその値なので、本番に当てても何も変わりません。
update storage.buckets
set
  file_size_limit = null,
  allowed_mime_types = null
where id = 'avatars';
