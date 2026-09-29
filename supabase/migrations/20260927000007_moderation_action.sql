-- strike-system Task 2: 本人への通知（moderation_action）
-- 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
--       要件定義書 3.9.1「本人への通知」（非公開化・削除・ストライク・投稿禁止のたびに理由を知らせる）
--
-- related_id は strikes.id（何を・なぜ・どの措置かは strikes の行から引く）

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action'
  ));

notify pgrst, 'reload schema';
