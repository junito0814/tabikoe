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
