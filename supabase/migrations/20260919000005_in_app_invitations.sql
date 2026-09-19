-- feedback-0919 Task6（v3.2）: しおり・アルバムのアプリ内招待
-- 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
--       要件定義書 v3.2 3.6.3・3.11.7・3.9.1・5.2・5.3「アプリ内招待」
--
-- 【初心者向け】招待の行（album_invitations／itinerary_invitations）に「誰宛てか」を足す。
--   - invitee_user_id が NULL   → 従来のリンク招待（token を開いた人が参加）
--   - invitee_user_id が入っている → アプリ内招待（その人だけが受諾・辞退できる。通知で届く）
--   - status: pending（未回答）／accepted／declined／revoked（オーナーが取り消し）
--   - 同じ相手への未回答の招待は 1 件だけ（部分ユニーク索引）
--   - 通知種別 album_invited／itinerary_invited（related_id は招待の id）

alter table public.album_invitations add column if not exists invitee_user_id uuid references public.users (id) on delete cascade;
alter table public.album_invitations add column if not exists status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked'));
alter table public.album_invitations add column if not exists responded_at timestamptz;
create unique index if not exists album_invitations_pending_invitee_unique on public.album_invitations (trip_id, invitee_user_id) where status = 'pending' and invitee_user_id is not null;
create index if not exists album_invitations_invitee_idx on public.album_invitations (invitee_user_id) where invitee_user_id is not null;

alter table public.itinerary_invitations add column if not exists invitee_user_id uuid references public.users (id) on delete cascade;
alter table public.itinerary_invitations add column if not exists status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked'));
alter table public.itinerary_invitations add column if not exists responded_at timestamptz;
create unique index if not exists itinerary_invitations_pending_invitee_unique on public.itinerary_invitations (itinerary_id, invitee_user_id) where status = 'pending' and invitee_user_id is not null;
create index if not exists itinerary_invitations_invitee_idx on public.itinerary_invitations (invitee_user_id) where invitee_user_id is not null;

-- 既存の無効化済みリンクは status も revoked に揃える
update public.album_invitations set status = 'revoked' where revoked_at is not null and status = 'pending';
update public.itinerary_invitations set status = 'revoked' where revoked_at is not null and status = 'pending';

-- 通知種別
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited'
  ));

notify pgrst, 'reload schema';
