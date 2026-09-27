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
