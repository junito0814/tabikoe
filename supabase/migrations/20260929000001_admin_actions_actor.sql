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
