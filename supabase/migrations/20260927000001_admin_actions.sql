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
