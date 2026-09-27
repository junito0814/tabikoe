-- admin-shell-dashboard Task 4: 管理者への通知（通知の種類を 3 つ足す）
-- 出典: docs/tasks/admin/admin-shell-dashboard/04-admin-notifications.md
--       要件定義書 3.9.1「管理者への通知」
--
-- 【初心者向け】通知の種類は notifications.type の CHECK 制約で固定している（20260912000001 以降、足すたびに作り直す）。
--   admin_report      … 新しい通報（related_id = 通報 ID）
--   admin_auto_hidden … 投稿が自動で非公開になった（related_id = 投稿／コメント ID。#553 が作る）
--   admin_suspended   … 仮停止した（related_id = 利用者 ID。#556 が作る）
-- 送り先は is_admin = true の利用者全員。

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended'
  ));

notify pgrst, 'reload schema';
