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
