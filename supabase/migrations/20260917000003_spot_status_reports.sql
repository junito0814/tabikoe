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
