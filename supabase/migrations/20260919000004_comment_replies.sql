-- feedback-0919 Task4（v3.2）: コメントへの返信
-- 出典: docs/tasks/shared-ui/feedback-0919/04-comment-reply.md
--       要件定義書 v3.2 3.5.3・3.9.1・5.2・5.3「コメントの返信」
--
-- 【初心者向け】
--   - parent_id: 返信先のコメント（NULL＝最上位）。返信への返信も「直接の返信先」を入れる
--   - root_id  : そのやり取りの最上位コメント。一覧は「最上位 20 件＋その root_id の返信」で取るので、再帰せずに済む
--   - deleted_at: 返信がある親を消したときの論理削除（「削除されたコメント」の枠を残す）。返信が無ければ物理削除する
--   - 親と同じ投稿でなければならない（トリガーで検証）
--   - 通知種別 comment_replied を追加

alter table public.comments add column if not exists parent_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists root_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists deleted_at timestamptz;
create index if not exists comments_root_idx on public.comments (root_id, created_at) where root_id is not null;
create index if not exists comments_post_top_idx on public.comments (post_id, created_at desc) where parent_id is null;

-- 親と同じ投稿でなければ拒否し、root_id を親から引き継ぐ（親が最上位なら親自身）
create or replace function public.comments_set_root()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    new.root_id := null;
    return new;
  end if;
  select post_id, root_id into parent from public.comments where id = new.parent_id;
  if parent is null then
    raise exception 'parent comment not found';
  end if;
  if parent.post_id <> new.post_id then
    raise exception 'parent comment belongs to another post';
  end if;
  new.root_id := coalesce(parent.root_id, new.parent_id);
  return new;
end $$;

drop trigger if exists comments_set_root on public.comments;
create trigger comments_set_root
  before insert on public.comments
  for each row execute function public.comments_set_root();

-- 通知種別
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed',
    'comment_replied'
  ));

notify pgrst, 'reload schema';
