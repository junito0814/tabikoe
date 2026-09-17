-- itinerary-sharing Task2: しおりの通知種別
-- 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
--       要件定義書 v3.0 3.9.1
--
-- 【初心者向け】notifications.type は CHECK 制約で値を固定している（20260912000001）。
-- しおりの参加（itinerary_joined）・削除（itinerary_member_removed）を足すには制約を作り直す必要がある。
-- related_id には itinerary_id を入れる（アルバムの通知は trip_id だが、しおりは itineraries.id）。

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment',
    'like',
    'album_join',
    'role_change',
    'member_removed',
    'new_owner',
    'report_resolved',
    'itinerary_joined',
    'itinerary_member_removed'
  ));
