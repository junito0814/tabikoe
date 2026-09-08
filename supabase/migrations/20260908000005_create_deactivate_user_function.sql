-- F-AC-05 Task1・Task2: 退会処理（ユーザー匿名化・関連データ削除・アルバムオーナー継承）
-- 出典: docs/tasks/account/account-deletion/01-deactivation-handler.md
--       docs/tasks/account/account-deletion/02-album-owner-succession.md
--
-- PL/pgSQL関数として1トランザクションにまとめることで、
-- 「途中で失敗した場合は全ての変更がロールバックされる」という要件を満たす。
-- Route Handlers（Service Role Key）からのみ呼び出す想定のためsecurity definerとする。

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
