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
