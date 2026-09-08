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
