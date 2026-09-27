-- Phase 17（管理画面の作り直し）のマイグレーションをまとめて当てる（Supabase の SQL エディタに貼る）。上から順に実行される。
-- 追加した順: 20260927000001_admin_actions → 20260927000002_strikes → 20260927000003_spots_created_at → 20260927000004_last_active_at → 20260927000005_admin_notifications → 20260927000006_user_management → 20260927000007_moderation_action

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

-- 追加した順（続き）: 20260927000002_strikes

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

-- 追加した順（続き）: 20260927000003_spots_created_at

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

-- 追加した順（続き）: 20260927000004_last_active_at

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

-- 追加した順（続き）: 20260927000005_admin_notifications

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

-- 追加した順（続き）: 20260927000006_user_management

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

-- 追加した順（続き）: 20260927000007_moderation_action

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
