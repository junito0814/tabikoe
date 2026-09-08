-- 修正: 退会時のアルバムオーナー継承が「移譲」になっていなかった問題
--
-- 20260908000005で作成した deactivate_user() には2つの不整合があった。
--
-- 1. 新オーナーのalbum_members.roleを'owner'に更新する一方で、
--    退会するユーザー自身のrole='owner'の行はそのまま残していたため、
--    継承後にオーナーが2人存在する状態になっていた。
--    → 継承先が決まったアルバムでは、退会者を'viewer'へ降格する。
--      退会後も投稿・コメントは残る（3.2.5）ため、メンバーシップ自体は削除せず残す
--      （要件定義書に明記のない設計判断。F-RC-03 アルバム共同編集の実装時に要確認）。
--
-- 2. trips.user_id を更新していなかった。20260908000001で定義したRLSポリシー
--    trips_owner_all は auth.uid() = trips.user_id をオーナー判定に使っているため、
--    album_membersだけ更新しても新オーナーは実際にはアルバムを操作できず、
--    退会済みユーザーが権限を持ち続けていた。
--    → 継承先へtrips.user_idも移す。

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
  -- オーナーを務める各アルバムについて、新オーナーを選出する
  -- （投稿数最多 > 同数なら参加日時が最も早いメンバー。3.6.3準拠）
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

      insert into public.notifications (user_id, type, related_id)
      values (v_successor.user_id, 'album_ownership_transferred', v_owned_trip.trip_id);
    end if;
    -- 残りメンバーがいない場合は何もしない
    -- （既存の「投稿0件で自動消滅」の扱いに合流する）
  end loop;

  delete from public.likes where user_id = p_user_id;
  delete from public.wishlist where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  -- posts・commentsは削除しない。投稿者表示はdisplay_name更新により自動的に匿名化される
  update public.users
    set display_name = '退会済みユーザー',
        avatar_url = '/default-avatar.svg',
        is_deleted = true
    where id = p_user_id;
end;
$$;

-- 20260908000008と同様に、この関数もservice_role専用に絞る
-- （create or replaceでは既存の権限設定が維持されるが、明示しておく）
revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;
