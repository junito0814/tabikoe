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
