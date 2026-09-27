-- user-management Task 2: 停止と解除・投稿の一括非公開・ストライクの取り消し
-- 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
--       要件定義書 3.10.9「利用者の管理」、3.9.1「本人への通知」
--
-- 【初心者向け】
--   1. posts.hidden_reason … なぜ非公開になったか。'moderation'（通報対応）／'suspension'（停止に伴う一括非公開）。
--      停止を解除したとき「停止で隠した分だけ」を戻せるように印を残す。自動非公開は #553 で別の列（auto_hidden_at）
--   2. 通知の種類に account_suspended / account_unsuspended（本人向け。related_id は本人の ID）

alter table public.posts add column if not exists hidden_reason text;
alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended'
  ));

notify pgrst, 'reload schema';
