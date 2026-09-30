-- ステージング環境（新しい Supabase プロジェクト）を作るときに、いちばん最初に 1 回だけ流す。
-- supabase/migrations/ の全 43 本を、ファイル名の順（＝当てた順）にそのまま並べたもの。
--
-- 使い方: 新しいプロジェクトの SQL エディタに貼って実行する。上から順に走る。
-- 注意: **本番のプロジェクトでは流さないこと**（すでに当たっているため、エラーになる）。
--
-- 出典: docs/deployment.md「8. ステージング環境を作る」
-- 作った日: 2026-09-30



-- ==============================================================================
-- 20260907000001_create_users_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000001_create_posts_tables.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000002_create_album_members_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000003_create_notifications_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000004_create_interaction_tables.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000005_create_deactivate_user_function.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000006_create_avatars_bucket.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000007_create_rate_limits_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000008_harden_privileges.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000009_fix_album_ownership_transfer.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000010_add_trips_title_unique.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000011_add_spots_nearby_search.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000012_grant_table_privileges.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000013_create_post_media_bucket.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260908000014_add_posts_value_constraints.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260911000001_create_badges_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260911000002_create_operation_logs_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260912000001_align_notification_types.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260912000002_create_reports_table.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260914000001_posts_visible_to_album_members.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260914000002_album_collaboration.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260914000003_admin_moderation.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260917000001_posts_draft_and_category.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260917000002_itineraries.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260917000003_spot_status_reports.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260917000004_deactivate_user_itineraries.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260918000001_itinerary_notification_types.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260919000001_daily_album.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260919000002_post_duration_7.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260919000003_spots_created_by.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260919000004_comment_replies.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260919000005_in_app_invitations.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000001_admin_actions.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000002_strikes.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000003_spots_created_at.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000004_last_active_at.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000005_admin_notifications.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000006_user_management.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000007_moderation_action.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000008_auto_hide.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000009_spot_fix_request.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260927000010_legal_documents.sql
-- ==============================================================================

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


-- ==============================================================================
-- 20260929000001_admin_actions_actor.sql
-- ==============================================================================

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
