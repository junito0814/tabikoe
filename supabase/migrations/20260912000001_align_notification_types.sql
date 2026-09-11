-- F-NT-01 Task2: 通知種別をカタログの値に固定し、既存の不一致を直す
-- 出典: docs/tasks/notifications/notification-triggers/02-notification-catalog.md
--       要件定義書3.9.1
--
-- 1. deactivate_user()（20260908000005 / 000009）は新オーナー選出の通知を
--    'album_ownership_transferred' で作っていたが、カタログでは 'new_owner'。
--    カタログを正として関数を差し替え、既存行も移行する。
-- 2. notifications.type をカタログの7値にCHECKで固定する。
--    アプリ側の createNotification() は型で守られるが、DBに直接書く経路
--    （deactivate_user のようなPL/pgSQL）は型検査が及ばないため、ここで担保する。

-- 既存行の移行（まだ退会が発生していなければ0件だが、冪等に書く）
update public.notifications
  set type = 'new_owner'
  where type = 'album_ownership_transferred';

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
    'report_resolved'
  ));

-- deactivate_user() を 'new_owner' で再定義（本体は 20260908000009 と同一）
create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_trip record;
  v_successor record;
begin
  for v_owned_trip in
    select trip_id from public.album_members
    where user_id = p_user_id and role = 'owner'
  loop
    select m.user_id, m.joined_at
      into v_successor
      from public.album_members m
      left join (
        select user_id, count(*) as post_count
        from public.posts
        where trip_id = v_owned_trip.trip_id
        group by user_id
      ) p on p.user_id = m.user_id
      where m.trip_id = v_owned_trip.trip_id
        and m.user_id <> p_user_id
      order by coalesce(p.post_count, 0) desc, m.joined_at asc
      limit 1;

    if found then
      update public.album_members
        set role = 'owner'
        where trip_id = v_owned_trip.trip_id and user_id = v_successor.user_id;

      update public.album_members
        set role = 'viewer'
        where trip_id = v_owned_trip.trip_id and user_id = p_user_id;

      update public.trips
        set user_id = v_successor.user_id
        where id = v_owned_trip.trip_id;

      -- 3.9.1「新オーナーへの選出」。type はカタログ（F-NT-01 Task2）に従う
      insert into public.notifications (user_id, type, related_id)
      values (v_successor.user_id, 'new_owner', v_owned_trip.trip_id);
    end if;
  end loop;

  delete from public.likes where user_id = p_user_id;
  delete from public.wishlist where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  update public.users
    set display_name = '退会済みユーザー',
        avatar_url = '/default-avatar.svg',
        is_deleted = true
    where id = p_user_id;
end;
$$;

revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;
