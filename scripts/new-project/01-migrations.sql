-- #896: 新しい Supabase プロジェクトを作るための SQL（1 / 2）
-- supabase/migrations/ を順につないだもの。**手で編集しない**（node scripts/build-new-project-sql.mjs で作り直す）
--
-- 【初心者向け】使い方:
--   新しいプロジェクトの SQL Editor に、01 から順に貼って実行する。
--   **順番が大事**（先に作った表に、あとから列・権限・ポリシーを足しているため）。
--   途中でエラーが出たらそこで止めて、出た文言をそのまま伝えること。先へ進まない。
--
-- この回に入っているもの（23 本）:
--   20260907000001_create_users_table.sql
--   20260908000001_create_posts_tables.sql
--   20260908000002_create_album_members_table.sql
--   20260908000003_create_notifications_table.sql
--   20260908000004_create_interaction_tables.sql
--   20260908000005_create_deactivate_user_function.sql
--   20260908000006_create_avatars_bucket.sql
--   20260908000007_create_rate_limits_table.sql
--   20260908000008_harden_privileges.sql
--   20260908000009_fix_album_ownership_transfer.sql
--   20260908000010_add_trips_title_unique.sql
--   20260908000011_add_spots_nearby_search.sql
--   20260908000012_grant_table_privileges.sql
--   20260908000013_create_post_media_bucket.sql
--   20260908000014_add_posts_value_constraints.sql
--   20260911000001_create_badges_table.sql
--   20260911000002_create_operation_logs_table.sql
--   20260912000001_align_notification_types.sql
--   20260912000002_create_reports_table.sql
--   20260914000001_posts_visible_to_album_members.sql
--   20260914000002_album_collaboration.sql
--   20260914000003_admin_moderation.sql
--   20260917000001_posts_draft_and_category.sql

-- ======================================================================
-- 20260907000001_create_users_table.sql
-- ======================================================================
-- F-AC-01 Task2: public.users テーブルの作成
-- 出典: docs/tasks/account/signup-login/02-users-table-migration.md
--
-- auth.users と同一IDで1対1対応させる。カラム構成・RLSポリシーは要件定義書5.3準拠。

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  idp_provider text not null,
  idp_subject text not null,
  email text not null,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  is_deleted boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  constraint users_idp_identity_unique unique (idp_provider, idp_subject)
);

alter table public.users enable row level security;

-- 本人のみ自分の行をSELECT/UPDATEできる。
-- Service Role Key（Route Handlers）はRLSを回避して全行にアクセスできるため、
-- 初回レコード作成（Task5）や管理者による操作はここにポリシーを追加しない。
--
-- 注意: RLSは行単位の制御しかできず、これだけでは本人が自分のis_adminを
-- trueに更新できてしまう。更新可能な列の制限は20260908000008_harden_privileges.sqlの
-- 列単位GRANTで行っている。
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ======================================================================
-- 20260908000001_create_posts_tables.sql
-- ======================================================================
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

drop policy if exists "trips_owner_all" on public.trips;
create policy "trips_owner_all"
  on public.trips
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- spotsはどのユーザーの投稿からも参照される共有マスタのため、閲覧のみ全ユーザーに許可する。
-- 作成・更新はRoute Handlers（Service Role Key）経由で行う想定（F-MP系ストーリーの対象）。
drop policy if exists "spots_select_all" on public.spots;
create policy "spots_select_all"
  on public.spots
  for select
  to authenticated
  using (true);

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "posts_owner_write" on public.posts;
create policy "posts_owner_write"
  on public.posts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "post_photos_select_visible" on public.post_photos;
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

drop policy if exists "post_photos_owner_write" on public.post_photos;
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

-- ======================================================================
-- 20260908000002_create_album_members_table.sql
-- ======================================================================
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

drop policy if exists "album_members_select_own" on public.album_members;
create policy "album_members_select_own"
  on public.album_members
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ======================================================================
-- 20260908000003_create_notifications_table.sql
-- ======================================================================
-- data-model/table-catalog Task3: notifications テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/03-notifications-table.md

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ======================================================================
-- 20260908000004_create_interaction_tables.sql
-- ======================================================================
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

-- ======================================================================
-- 20260908000005_create_deactivate_user_function.sql
-- ======================================================================
-- F-AC-05 Task1・Task2: 退会処理（ユーザー匿名化・関連データ削除・アルバムオーナー継承）
-- 出典: docs/tasks/account/account-deletion/01-deactivation-handler.md
--       docs/tasks/account/account-deletion/02-album-owner-succession.md
--
-- PL/pgSQL関数として1トランザクションにまとめることで、
-- 「途中で失敗した場合は全ての変更がロールバックされる」という要件を満たす。
-- Route Handlers（Service Role Key）からのみ呼び出す想定のためsecurity definerとする。

create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_trip record;
  v_successor record;
begin
  -- オーナーを務める各アルバムについて、新オーナーを選出する
  -- （投稿数最多 > 同数なら参加日時が最も早いメンバー。3.6.3準拠）
  for v_owned_trip in
    select trip_id from public.album_members
    where user_id = p_user_id and role = 'owner'
  loop
    select m.user_id, m.joined_at
      into v_successor
      from public.album_members m
      left join (
        select user_id, count(*) as post_count
        from public.posts
        where trip_id = v_owned_trip.trip_id
        group by user_id
      ) p on p.user_id = m.user_id
      where m.trip_id = v_owned_trip.trip_id
        and m.user_id <> p_user_id
      order by coalesce(p.post_count, 0) desc, m.joined_at asc
      limit 1;

    if found then
      update public.album_members
        set role = 'owner'
        where trip_id = v_owned_trip.trip_id and user_id = v_successor.user_id;

      insert into public.notifications (user_id, type, related_id)
      values (v_successor.user_id, 'album_ownership_transferred', v_owned_trip.trip_id);
    end if;
    -- 残りメンバーがいない場合は何もしない
    -- （既存の「投稿0件で自動消滅」の扱いに合流する）
  end loop;

  delete from public.likes where user_id = p_user_id;
  delete from public.wishlist where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  -- posts・commentsは削除しない。投稿者表示はdisplay_name更新により自動的に匿名化される
  update public.users
    set display_name = '退会済みユーザー',
        avatar_url = '/default-avatar.svg',
        is_deleted = true
    where id = p_user_id;
end;
$$;

-- ======================================================================
-- 20260908000006_create_avatars_bucket.sql
-- ======================================================================
-- F-AC-04 Task4: アイコン画像用Storageバケットの作成
-- 出典: docs/tasks/account/profile-edit/04-avatar-upload-handler.md
--
-- アップロード自体はRoute Handlers（Service Role Key）が行うためRLSを回避するが、
-- 表示（<img>タグからの読み込み）は誰でも可能である必要があるためbucketをpublicにする。
-- 以下のポリシーは、将来ブラウザから直接Storageへアップロードする経路を追加する場合に備えるもの。

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_select_all" on storage.objects;
create policy "avatars_select_all"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ======================================================================
-- 20260908000007_create_rate_limits_table.sql
-- ======================================================================
-- data-model/table-catalog Task1: rate_limits テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/01-rate-limits-table.md
--
-- 固定ウィンドウ（例：1分）ごとに(subject, action_type)の試行回数を数える。
-- subjectはuser_idまたはIPアドレス文字列（F-AC-01 Task8はIPアドレスを使う）。

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  action_type text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  constraint rate_limits_subject_action_window_unique unique (subject, action_type, window_start)
);

alter table public.rate_limits enable row level security;
-- Route Handlers（Service Role Key）からのみ操作する想定のため、authenticated向けポリシーは追加しない。

-- F-AC-01 Task8: ログイン試行のレート制限
-- 出典: docs/tasks/account/signup-login/08-login-rate-limiting.md
--
-- (subject, action_type, window_start)の行をアトミックにインクリメントし、
-- 上限を超えたかどうかを返す。呼び出し側でカウントを読んでから判定すると
-- 同時リクエストでの競合が起きうるため、INSERT ... ON CONFLICTで1回のクエリに集約する。
create or replace function public.check_rate_limit(
  p_subject text,
  p_action_type text,
  p_window_seconds integer,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (subject, action_type, window_start, count)
  values (p_subject, p_action_type, v_window_start, 1)
  on conflict (subject, action_type, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ======================================================================
-- 20260908000008_harden_privileges.sql
-- ======================================================================
-- セキュリティ修正: SECURITY DEFINER関数の実行権限と、usersテーブルの列単位更新権限を絞る
--
-- 背景（このマイグレーション以前の状態で実際に悪用可能だったもの）:
--
-- 1. PostgreSQLは新規作成した関数に既定でPUBLICへEXECUTEを付与し、Supabaseは
--    publicスキーマの関数をPostgRESTのRPCエンドポイントとして公開する。
--    そのためbrowserに配布されるpublishable(anon)キーだけで
--    POST /rest/v1/rpc/deactivate_user に任意のユーザーIDを渡せてしまい、
--    SECURITY DEFINERでRLSを回避したまま他人のアカウントを匿名化・データ削除できた。
--    check_rate_limitも同様に、任意のsubject（他人のIPアドレス）のカウンタを
--    外部から加算してログイン不能にできた。
--    → 両関数ともRoute Handlers（Service Role Key）専用のため、service_roleのみに絞る。
--
-- 2. usersのRLSポリシー users_update_own は行単位の制御しかしておらず、
--    列単位のGRANTも既定のまま（authenticatedに全列UPDATE可）だった。
--    そのため認証済みユーザーが PATCH /rest/v1/users?id=eq.<自分のid> に
--    {"is_admin": true} を送るだけで管理者に昇格でき、
--    src/proxy.ts の /admin ガードを無効化できた。
--    → RLSでは列を制限できないため、列単位のGRANTで更新可能な列を限定する。

revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, text, integer, integer) from anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

-- is_admin / is_deleted / email / idp_provider / idp_subject / consented_at / created_at は
-- 本人からは更新させない（管理者権限の自己付与・同意日時の改ざん等を防ぐ）。
-- これらの更新はすべてRoute Handlers（Service Role Key）経由で行う。
revoke update on public.users from anon, authenticated;
grant update (display_name, avatar_url) on public.users to authenticated;

-- ======================================================================
-- 20260908000009_fix_album_ownership_transfer.sql
-- ======================================================================
-- 修正: 退会時のアルバムオーナー継承が「移譲」になっていなかった問題
--
-- 20260908000005で作成した deactivate_user() には2つの不整合があった。
--
-- 1. 新オーナーのalbum_members.roleを'owner'に更新する一方で、
--    退会するユーザー自身のrole='owner'の行はそのまま残していたため、
--    継承後にオーナーが2人存在する状態になっていた。
--    → 継承先が決まったアルバムでは、退会者を'viewer'へ降格する。
--      退会後も投稿・コメントは残る（3.2.5）ため、メンバーシップ自体は削除せず残す
--      （要件定義書に明記のない設計判断。F-RC-03 アルバム共同編集の実装時に要確認）。
--
-- 2. trips.user_id を更新していなかった。20260908000001で定義したRLSポリシー
--    trips_owner_all は auth.uid() = trips.user_id をオーナー判定に使っているため、
--    album_membersだけ更新しても新オーナーは実際にはアルバムを操作できず、
--    退会済みユーザーが権限を持ち続けていた。
--    → 継承先へtrips.user_idも移す。

create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_trip record;
  v_successor record;
begin
  -- オーナーを務める各アルバムについて、新オーナーを選出する
  -- （投稿数最多 > 同数なら参加日時が最も早いメンバー。3.6.3準拠）
  for v_owned_trip in
    select trip_id from public.album_members
    where user_id = p_user_id and role = 'owner'
  loop
    select m.user_id, m.joined_at
      into v_successor
      from public.album_members m
      left join (
        select user_id, count(*) as post_count
        from public.posts
        where trip_id = v_owned_trip.trip_id
        group by user_id
      ) p on p.user_id = m.user_id
      where m.trip_id = v_owned_trip.trip_id
        and m.user_id <> p_user_id
      order by coalesce(p.post_count, 0) desc, m.joined_at asc
      limit 1;

    if found then
      update public.album_members
        set role = 'owner'
        where trip_id = v_owned_trip.trip_id and user_id = v_successor.user_id;

      update public.album_members
        set role = 'viewer'
        where trip_id = v_owned_trip.trip_id and user_id = p_user_id;

      update public.trips
        set user_id = v_successor.user_id
        where id = v_owned_trip.trip_id;

      insert into public.notifications (user_id, type, related_id)
      values (v_successor.user_id, 'album_ownership_transferred', v_owned_trip.trip_id);
    end if;
    -- 残りメンバーがいない場合は何もしない
    -- （既存の「投稿0件で自動消滅」の扱いに合流する）
  end loop;

  delete from public.likes where user_id = p_user_id;
  delete from public.wishlist where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  -- posts・commentsは削除しない。投稿者表示はdisplay_name更新により自動的に匿名化される
  update public.users
    set display_name = '退会済みユーザー',
        avatar_url = '/default-avatar.svg',
        is_deleted = true
    where id = p_user_id;
end;
$$;

-- 20260908000008と同様に、この関数もservice_role専用に絞る
-- （create or replaceでは既存の権限設定が維持されるが、明示しておく）
revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;

-- ======================================================================
-- 20260908000010_add_trips_title_unique.sql
-- ======================================================================
-- F-PO-01 旅行タイトル Task2: 同一ユーザー内でのタイトル一意性をDB制約として担保する
-- 出典: docs/tasks/posts/trip-title/02-trip-resolution-logic.md
--       要件定義書3.3.4「一意性の範囲：同一ユーザー内でのみ一意」
--
-- 「トリム後の完全一致で既存旅行を探し、無ければ作成する」ロジックは、
-- 同一ユーザーの同時投稿で同じタイトルが重複作成されうる。
-- タイトルは常にトリム済みで保存する前提で、(user_id, title)に一意制約を張る。

alter table public.trips
  drop constraint if exists trips_user_title_unique;

alter table public.trips
  add constraint trips_user_title_unique unique (user_id, title);

-- ======================================================================
-- 20260908000011_add_spots_nearby_search.sql
-- ======================================================================
-- F-PO-01 スポット指定 Task1: spots テーブルの近傍検索インデックス整備
-- 出典: docs/tasks/posts/spot-selection/01-spots-geo-search-index.md
--
-- タスク仕様は「PostGISのgeographyインデックス、または簡易的な範囲検索＋Haversine計算の
-- いずれか」を認めている。PostGIS拡張の有効化という追加依存を避けるため後者を採用する。
-- 判定対象は半径50m・候補は最大5件程度の規模のため、矩形で絞ってからHaversineで
-- 正確に距離を出す方式で十分。
--
-- 重複登録防止（Task5）と候補検索（Task2）の双方から利用する。

create index if not exists spots_lat_lng_idx on public.spots (lat, lng);

create or replace function public.find_nearby_spots(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  prefecture text,
  source text,
  distance_meters double precision
)
language sql
stable
as $$
  -- 緯度1度は約111,320m。経度1度の距離はcos(緯度)倍に縮むため、
  -- 極付近で0除算にならないようgreatestで下限を設ける。
  select *
  from (
    select
      s.id,
      s.name,
      s.lat,
      s.lng,
      s.prefecture,
      s.source,
      6371000.0 * 2 * asin(sqrt(
        power(sin(radians(s.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(s.lat))
        * power(sin(radians(s.lng - p_lng) / 2), 2)
      )) as distance_meters
    from public.spots s
    where s.lat between p_lat - (p_radius_meters / 111320.0)
                    and p_lat + (p_radius_meters / 111320.0)
      and s.lng between p_lng - (p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.000001)))
                    and p_lng + (p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.000001)))
  ) candidates
  where candidates.distance_meters <= p_radius_meters
  order by candidates.distance_meters
$$;

-- security invoker（既定）のためRLSがそのまま効く。
-- spots_select_allにより認証済みユーザーは閲覧可能なので、実行権限を絞る必要はない。

-- ======================================================================
-- 20260908000012_grant_table_privileges.sql
-- ======================================================================
-- 修正: テーブル権限（GRANT）が付与されておらず、全テーブルが利用できなかった問題
--
-- これまでのマイグレーションは、Supabaseが`public`スキーマの新規テーブルに対して
-- anon/authenticated/service_roleへ自動でGRANTすることを暗黙の前提にしていた。
-- 実際のプロジェクトではその既定権限が効いておらず、Service Role Keyでのアクセスすら
-- 「permission denied for table users」（42501）で失敗していた。
-- マイグレーションはプロジェクト側の既定に依存せず、必要な権限を明示的に付与する。
--
-- 方針（要件定義書5.3）:
--   - service_role : Route Handlersからの全アクセス経路。全テーブルに全権限
--   - authenticated: RLSを二重の防御線として機能させるため、ユーザースコープの
--                    クライアントで実際に触る操作のみ許可する
--   - anon         : 全機能がログイン必須（3.5.4）のため付与しない

-- service_role: Route Handlers（RLS回避）用
grant all privileges on table
  public.users,
  public.trips,
  public.spots,
  public.posts,
  public.post_photos,
  public.album_members,
  public.notifications,
  public.comments,
  public.likes,
  public.wishlist,
  public.blocks,
  public.rate_limits
to service_role;

-- authenticated: 更新可能な列は20260908000008で絞ってあるため、ここではSELECTのみ付与する
-- （is_admin等を本人が書き換えられる状態に戻さないこと）
grant select on table public.users to authenticated;
grant update (display_name, avatar_url) on table public.users to authenticated;

-- 自分のデータをRLSの範囲内で読み書きするテーブル
grant select, insert, update, delete on table
  public.trips,
  public.posts,
  public.post_photos,
  public.comments,
  public.likes,
  public.wishlist,
  public.blocks
to authenticated;

-- 参照のみ許可。書き込みはRoute Handlers（service_role）経由で行う
--   spots         : 全ユーザー共有のマスタ
--   album_members : 権限変更はF-RC-03のアルバム機能で扱う
--   notifications : 発生元の各機能がservice_roleでINSERTする
grant select on table
  public.spots,
  public.album_members,
  public.notifications
to authenticated;

-- rate_limitsはRoute Handlers専用のため、authenticatedには一切付与しない

-- ======================================================================
-- 20260908000013_create_post_media_bucket.sql
-- ======================================================================
-- F-PO-01 Task4: 投稿の写真・動画用Storageバケットの作成
-- 出典: docs/tasks/posts/post-creation/04-media-upload-integration.md
--       要件定義書5.4（保存先はSupabase Storage）
--
-- アイコン用のavatarsバケットと異なり、**非公開バケット**とする。
-- 投稿には公開／非公開の設定があり（3.3.6）、非公開投稿の写真が
-- URLを知っていれば誰でも取得できる状態は、その設定の意味を失わせるため。
-- 配信は署名付きURLで行い、post_photos.storage_urlにはバケット内のパスを保存する。

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do nothing;

-- 読み取り・書き込みともRoute Handlers（Service Role Key）経由で行うため、
-- authenticated向けのポリシーは追加しない。
-- 署名付きURLの発行時に投稿の公開範囲を判定する。

-- ======================================================================
-- 20260908000014_add_posts_value_constraints.sql
-- ======================================================================
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

-- ======================================================================
-- 20260911000001_create_badges_table.sql
-- ======================================================================
-- data-model/table-catalog Task4: badges テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/04-badges-table.md
--       要件定義書3.7（都道府県バッジ・投稿数バッジ・いいね数バッジ）
--
-- badge_type は「種別:レベル」の1列で表す（タスク仕様が単一列を指定しているため）。
--   prefecture:<都道府県名>   例: prefecture:沖縄県
--   post_count:<閾値>         1 / 10 / 50 / 100
--   like_count:<閾値>         1 / 10 / 50 / 100 / 200
-- 閾値は3.7で確定しているためCHECK制約で固定し、判定ロジック側の誤りが
-- 不正なレベルとして混入しないようにする（postsの入力規則と同じ考え方）。
--
-- 獲得済みバッジは投稿削除で条件を下回っても失われない（3.7）。
-- そのため投稿・いいねとは外部キーで結ばず、獲得時にINSERTするだけの独立した記録にする。

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  badge_type text not null,
  acquired_at timestamptz not null default now(),
  constraint badges_user_type_unique unique (user_id, badge_type),
  constraint badges_type_check check (
    badge_type ~ '^prefecture:.+$'
    or badge_type in (
      'post_count:1', 'post_count:10', 'post_count:50', 'post_count:100',
      'like_count:1', 'like_count:10', 'like_count:50', 'like_count:100', 'like_count:200'
    )
  )
);

alter table public.badges enable row level security;

-- 本人は自分の獲得済みバッジを閲覧できる（SC-10）。付与はRoute Handlers（service_role）が行う
drop policy if exists "badges_select_own" on public.badges;
create policy "badges_select_own"
  on public.badges
  for select
  to authenticated
  using (auth.uid() = user_id);

grant all privileges on table public.badges to service_role;
grant select on table public.badges to authenticated;

-- ======================================================================
-- 20260911000002_create_operation_logs_table.sql
-- ======================================================================
-- data-model/table-catalog Task6: operation_logs テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/06-operation-logs-table.md
--       要件定義書7.5（操作ログ：対象操作・保存期間90日・閲覧は管理者のみ）
--
-- ログイン成功／失敗など、ユーザーが確定しない操作もあるため user_id は NULL 許容。
-- 退会したユーザーのログも監査上は残したいが、users への FK は on delete cascade の
-- 方針（他テーブルと統一）に合わせる。退会は論理削除（is_deleted）で行が残るため、
-- 実際に行が消えるのは auth.users 側を物理削除した場合のみ。
--
-- 90日超の物理削除バッチは本タスクの対象外（運用上の未決定事項、9章に準じる）。
-- created_at のインデックスは、その削除処理と管理画面での期間検索の両方に効く。

create table if not exists public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  action_type text not null,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now(),
  constraint operation_logs_action_type_check check (
    action_type in (
      'login_success',
      'login_failure',
      'post_create',
      'post_update',
      'post_delete',
      'comment_create',
      'comment_delete',
      'report_create',
      'account_create',
      'account_delete',
      'admin_action'
    )
  )
);

create index if not exists operation_logs_created_at_idx
  on public.operation_logs (created_at);

create index if not exists operation_logs_user_id_idx
  on public.operation_logs (user_id);

alter table public.operation_logs enable row level security;

-- 閲覧は管理者のみ（7.5）。is_admin は本人が書き換えられないよう列単位GRANTで守られている
-- （20260908000008）ため、この判定を信頼してよい。
drop policy if exists "operation_logs_select_admin" on public.operation_logs;
create policy "operation_logs_select_admin"
  on public.operation_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 書き込みは各Route Handlerが共通ヘルパー経由で service_role として行う。
-- authenticated に INSERT を許すと、自分の操作ログを偽造できてしまう。
grant all privileges on table public.operation_logs to service_role;
grant select on table public.operation_logs to authenticated;

-- ======================================================================
-- 20260912000001_align_notification_types.sql
-- ======================================================================
-- F-NT-01 Task2: 通知種別をカタログの値に固定し、既存の不一致を直す
-- 出典: docs/tasks/notifications/notification-triggers/02-notification-catalog.md
--       要件定義書3.9.1
--
-- 1. deactivate_user()（20260908000005 / 000009）は新オーナー選出の通知を
--    'album_ownership_transferred' で作っていたが、カタログでは 'new_owner'。
--    カタログを正として関数を差し替え、既存行も移行する。
-- 2. notifications.type をカタログの7値にCHECKで固定する。
--    アプリ側の createNotification() は型で守られるが、DBに直接書く経路
--    （deactivate_user のようなPL/pgSQL）は型検査が及ばないため、ここで担保する。

-- 既存行の移行（まだ退会が発生していなければ0件だが、冪等に書く）
update public.notifications
  set type = 'new_owner'
  where type = 'album_ownership_transferred';

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
    'report_resolved'
  ));

-- deactivate_user() を 'new_owner' で再定義（本体は 20260908000009 と同一）
create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_trip record;
  v_successor record;
begin
  for v_owned_trip in
    select trip_id from public.album_members
    where user_id = p_user_id and role = 'owner'
  loop
    select m.user_id, m.joined_at
      into v_successor
      from public.album_members m
      left join (
        select user_id, count(*) as post_count
        from public.posts
        where trip_id = v_owned_trip.trip_id
        group by user_id
      ) p on p.user_id = m.user_id
      where m.trip_id = v_owned_trip.trip_id
        and m.user_id <> p_user_id
      order by coalesce(p.post_count, 0) desc, m.joined_at asc
      limit 1;

    if found then
      update public.album_members
        set role = 'owner'
        where trip_id = v_owned_trip.trip_id and user_id = v_successor.user_id;

      update public.album_members
        set role = 'viewer'
        where trip_id = v_owned_trip.trip_id and user_id = p_user_id;

      update public.trips
        set user_id = v_successor.user_id
        where id = v_owned_trip.trip_id;

      -- 3.9.1「新オーナーへの選出」。type はカタログ（F-NT-01 Task2）に従う
      insert into public.notifications (user_id, type, related_id)
      values (v_successor.user_id, 'new_owner', v_owned_trip.trip_id);
    end if;
  end loop;

  delete from public.likes where user_id = p_user_id;
  delete from public.wishlist where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  update public.users
    set display_name = '退会済みユーザー',
        avatar_url = '/default-avatar.svg',
        is_deleted = true
    where id = p_user_id;
end;
$$;

revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;

-- ======================================================================
-- 20260912000002_create_reports_table.sql
-- ======================================================================
-- F-SF-01 Task1: reports テーブルの作成
-- 出典: docs/tasks/safety/reporting/01-reports-schema-migration.md
--       要件定義書 3.8.1（通報対象・理由・対応状態）、5.2（reports）
--
-- target_type ごとに参照先テーブルが異なるポリモーフィック関連のため、target_id にはFKを張らない。
-- 対象の存在確認と reason × target_type の組み合わせ検証はアプリ層（POST /api/reports）で行う。
-- 対応状態の更新（status/resolved_*）は管理者機能（F-AD-05）が service_role で行う。

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  detail text,
  status text not null default 'unconfirmed',
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint reports_target_type_check check (
    target_type in ('post', 'post_photo', 'post_review', 'comment', 'user', 'spot', 'trip')
  ),
  constraint reports_reason_check check (
    reason in (
      'inappropriate', 'personal_info', 'false_info', 'copyright',
      'spam', 'impersonation', 'wrong_spot_info', 'other'
    )
  ),
  constraint reports_status_check check (
    status in ('unconfirmed', 'in_review', 'resolved_hidden', 'resolved_deleted', 'no_issue')
  ),
  -- 自由記述は1,000文字まで（書記素単位の厳密な判定はアプリ層。ここは安全弁）
  constraint reports_detail_length_check check (detail is null or char_length(detail) <= 4000),
  -- 同一ユーザーが同一対象に重複して通報できない
  constraint reports_reporter_target_unique unique (reporter_id, target_type, target_id)
);

-- 管理画面（SC-18）での絞り込み用
create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- 通報者は自分の通報を作成・閲覧できる。他人の通報・被通報の事実は見せない（匿名性、3.8.1）
drop policy if exists "reports_reporter_select" on public.reports;
create policy "reports_reporter_select"
  on public.reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "reports_reporter_insert" on public.reports;
create policy "reports_reporter_insert"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- このプロジェクトはテーブル権限を自動付与しないため明示する（20260908000012 と同じ方針）。
-- 一般ユーザーは status 等の対応情報を書けない（INSERT対象カラムを限定）。
grant all privileges on table public.reports to service_role;
grant select on table public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, detail) on table public.reports to authenticated;

-- ======================================================================
-- 20260914000001_posts_visible_to_album_members.sql
-- ======================================================================
-- F-VW-01 Task1: 非公開投稿をアルバムメンバーにも見せる（RLS の二重防御）
-- 出典: docs/tasks/browsing/post-detail-view/01-post-detail-handler.md
--       要件定義書3.3.6（アルバム共有時）・3.6.3（アルバム内での公開設定の扱い）・7.2
--
-- 20260908000001 の posts_select_visible は「公開 or 本人」だけだった。
-- 投稿が属する旅行（trip）のアルバムメンバー（owner/editor/viewer）は、公開設定にかかわらず
-- その投稿を閲覧できる（3.6.3）。Route Handler（GET /api/posts/[id]）で同じ判定を行うが、
-- PostgREST 直接アクセスでも同じ結果になるようポリシー側にも同じ条件を持たせる。
-- post_photos・comments の閲覧ポリシーも同じ判定に揃える。

create or replace function public.can_view_post(p_trip_id uuid, p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
as $$
  select p_visibility = 'public'
      or p_owner_id = auth.uid()
      or exists (
        select 1 from public.album_members m
        where m.trip_id = p_trip_id and m.user_id = auth.uid()
      )
$$;

-- security invoker（既定）。album_members の RLS は自分の行しか見せないため、
-- 「自分がメンバーか」の判定にはそれで十分。

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (public.can_view_post(trip_id, user_id, visibility));

drop policy if exists "post_photos_select_visible" on public.post_photos;
create policy "post_photos_select_visible"
  on public.post_photos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id
        and public.can_view_post(p.trip_id, p.user_id, p.visibility)
    )
  );

drop policy if exists "comments_select_visible_post" on public.comments;
create policy "comments_select_visible_post"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and public.can_view_post(p.trip_id, p.user_id, p.visibility)
    )
  );

-- コメント・いいねは公開投稿にしか付かない（3.3.6）。書き込みポリシーにも条件を足しておく
drop policy if exists "comments_owner_write" on public.comments;
create policy "comments_owner_write"
  on public.comments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = comments.post_id and p.visibility = 'public')
  );

drop policy if exists "likes_owner_all" on public.likes;
create policy "likes_owner_all"
  on public.likes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = likes.post_id and p.visibility = 'public')
  );

-- 一覧・件数取得で使う索引
create index if not exists comments_post_created_idx on public.comments (post_id, created_at desc);
create index if not exists likes_post_idx on public.likes (post_id);

-- ======================================================================
-- 20260914000002_album_collaboration.sql
-- ======================================================================
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

-- ======================================================================
-- 20260914000003_admin_moderation.sql
-- ======================================================================
-- F-AD-03 Task1: system_announcements テーブル
-- F-AD-05 Task1: 通報対応（非公開化・アカウント一時停止）のための列
-- 出典: docs/tasks/admin/announcement-management/01-system-announcements-table.md
--       docs/tasks/admin/report-handling/01-report-action-handler.md
--       要件定義書3.10.3・3.10.5・5.2

-- 1. 運営からのお知らせ（1件が全ユーザーに配信される。宛先カラムは持たない）
create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 文字数の厳密な判定（書記素単位）はアプリ層。ここは安全弁
  constraint system_announcements_title_length_check check (char_length(title) <= 400),
  constraint system_announcements_body_length_check check (char_length(body) <= 8000)
);

create index if not exists system_announcements_published_at_idx
  on public.system_announcements (published_at desc);

alter table public.system_announcements enable row level security;

-- ログイン済み全ユーザーが読める（通知一覧 SC-14）。公開日時が未来のものは読み取り側で除外する
drop policy if exists "system_announcements_select_all" on public.system_announcements;
create policy "system_announcements_select_all"
  on public.system_announcements
  for select
  to authenticated
  using (true);

-- 作成・編集・削除は is_admin のみ（Route Handler は service_role で書くが、直接アクセスにも同じ制限）
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
$$;

revoke execute on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated, service_role;

drop policy if exists "system_announcements_admin_write" on public.system_announcements;
create policy "system_announcements_admin_write"
  on public.system_announcements
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant all privileges on table public.system_announcements to service_role;
grant select on table public.system_announcements to authenticated;
grant insert, update, delete on table public.system_announcements to authenticated;

-- 2. 通報対応（3.10.5）
--   非公開化: 対象を一般ユーザーから見えなくする（復元可能）。hidden_at で表す
--   ユーザー: アカウントの一時停止（suspended_at）。ログインを拒否する
--   スポット・アルバム: 当該スポット／アルバムの非公開化
alter table public.posts add column if not exists hidden_at timestamptz;
-- 感想テキスト（post_review）だけを非公開化する場合
alter table public.posts add column if not exists review_hidden_at timestamptz;
alter table public.post_photos add column if not exists hidden_at timestamptz;
alter table public.comments add column if not exists hidden_at timestamptz;
alter table public.spots add column if not exists hidden_at timestamptz;
alter table public.trips add column if not exists hidden_at timestamptz;
alter table public.users add column if not exists suspended_at timestamptz;

create index if not exists posts_hidden_at_idx on public.posts (hidden_at) where hidden_at is not null;

-- 非公開化された投稿・コメントは本人以外に見せない（RLS の二重防御）
create or replace function public.can_view_post(p_trip_id uuid, p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
as $$
  select p_visibility = 'public'
      or p_owner_id = auth.uid()
      or public.is_album_member(p_trip_id)
$$;

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (
    (hidden_at is null or user_id = auth.uid())
    and public.can_view_post(trip_id, user_id, visibility)
  );

drop policy if exists "comments_select_visible_post" on public.comments;
create policy "comments_select_visible_post"
  on public.comments
  for select
  to authenticated
  using (
    (hidden_at is null or user_id = auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and public.can_view_post(p.trip_id, p.user_id, p.visibility)
    )
  );

-- suspended_at・hidden_at はユーザー本人が書き換えられないよう、列単位の権限を確認する。
-- users.update は 20260908000008/12 で display_name・avatar_url に限定済み。
-- posts/comments/trips は authenticated に update 権限があるため、これらの列を除外する。
revoke update on table public.posts from authenticated;
grant update (trip_id, spot_id, category, visit_date, duration, cost, rating, comment, visibility)
  on table public.posts to authenticated;
revoke update on table public.comments from authenticated;
-- コメントは編集不可（3.5.3）のため update 権限は付与しない
revoke update on table public.trips from authenticated;
grant update (title) on table public.trips to authenticated;
revoke update on table public.post_photos from authenticated;
grant update (display_order) on table public.post_photos to authenticated;

-- ======================================================================
-- 20260917000001_posts_draft_and_category.sql
-- ======================================================================
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
