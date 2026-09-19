-- v3.1（Phase 15）のマイグレーションをまとめて当てる（Supabase の SQL エディタに貼る）。上から順に実行される。
-- 追加した順: 20260919000001_daily_album → 20260919000002_post_duration_7

-- mentoring-7 Task2（v3.1）: 「日常」アルバム
-- 出典: docs/tasks/shared-ui/mentoring-7/02-daily-album.md
--       要件定義書 v3.1 3.3.4・3.6.2・5.3「「日常」アルバム」
--
-- 【初心者向け】アルバム欄を空にして投稿したときの入れ物を、仮タイトル「今日の投稿（M/D）」の旅行から
-- 「日常」（1 人 1 つ、is_daily = true）に変える。
--   1. trips.is_daily 列と「1 人 1 行だけ true」の部分ユニーク索引
--   2. 既存の仮タイトルの旅行を各ユーザーの「日常」へ統合（投稿・下書きの trip_id を付け替え、空になった旅行は削除）
-- 「日常」の名前変更・削除・招待・しおり作成は Route Handlers 側で 400 にする（DB では縛らない）。

-- 1. 列と索引
alter table public.trips add column if not exists is_daily boolean not null default false;
create unique index if not exists trips_daily_per_user_unique on public.trips (user_id) where is_daily;

-- 2. 仮タイトルの旅行を「日常」へ統合
do $$
declare
  r record;
  daily_id uuid;
begin
  -- 仮タイトルの旅行を持つユーザーごとに処理する
  for r in
    select distinct user_id from public.trips where title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$'
  loop
    -- その人の「日常」を探す（is_daily 優先、無ければ title = '日常' を昇格、それも無ければ作る）
    select id into daily_id from public.trips where user_id = r.user_id and is_daily limit 1;
    if daily_id is null then
      select id into daily_id from public.trips where user_id = r.user_id and title = '日常' limit 1;
      if daily_id is not null then
        update public.trips set is_daily = true where id = daily_id;
      else
        insert into public.trips (user_id, title, is_daily) values (r.user_id, '日常', true) returning id into daily_id;
      end if;
    end if;

    -- 仮タイトルの旅行の投稿・下書きを「日常」へ。しおり（itineraries）は仮タイトルには作れないので考慮しない
    update public.posts p
      set trip_id = daily_id
      from public.trips t
      where p.trip_id = t.id
        and t.user_id = r.user_id
        and t.title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$';

    -- 空になった仮タイトルの旅行を削除（album_members はオーナー行だけなので cascade で消える）
    delete from public.trips t
      where t.user_id = r.user_id
        and t.title ~ '^今日の投稿（[0-9]{1,2}/[0-9]{1,2}）$'
        and not exists (select 1 from public.posts p where p.trip_id = t.id);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---- 20260919000002_post_duration_7 ----
-- feedback-0919 Task1（v3.2）: 滞在時間を 7 択に
-- 出典: docs/tasks/shared-ui/feedback-0919/01-stay-time.md
--       要件定義書 v3.2 3.3.1・5.3「滞在時間の移行」
--
-- 【初心者向け】選択肢を 30分以内／1時間以内／2時間以内／3時間以内／半日／1日／宿泊 の 7 つにする。
-- 既存の「それ以上」は書き換えない（投稿者の意図を勝手に変えない）ので、CHECK 制約は 7 値＋旧値の 8 値を許す。
-- 新規・編集で 7 値だけを受け付けるのはアプリ側（validate-post-input.ts）の仕事。

alter table public.posts drop constraint if exists posts_duration_check;
alter table public.posts
  add constraint posts_duration_check
  check (duration in ('30分以内', '1時間以内', '2時間以内', '3時間以内', '半日', '1日', '宿泊', 'それ以上'));

notify pgrst, 'reload schema';
