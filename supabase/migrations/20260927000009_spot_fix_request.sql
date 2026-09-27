-- strike-system Task 6: スポットの修正依頼（通知の種類 spot_fix_request）
-- 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
--       要件定義書 3.10.6「スポット情報の誤り」・3.10.13
--
-- related_id はスポット ID（タップで /spots/[id]/edit を開く）。管理者のメモは admin_actions（spot_fix_request）の note から引く

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action',
    'spot_fix_request'
  ));

notify pgrst, 'reload schema';
