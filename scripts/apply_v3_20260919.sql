-- v3.1（Phase 15）のマイグレーションをまとめて当てる（Supabase の SQL エディタに貼る）。上から順に実行される。
-- 追加した順: 20260919000001_daily_album → 20260919000002_post_duration_7 → 20260919000003_spots_created_by → 20260919000004_comment_replies

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

-- ---- 20260919000003_spots_created_by ----
-- feedback-0919 Task2（v3.2）: スポット登録バッジ（spots.created_by）
-- 出典: docs/tasks/shared-ui/feedback-0919/02-spot-badge.md
--       要件定義書 v3.2 3.7・5.2・5.3「スポット登録者」
--
-- 【初心者向け】「タビコエだけの場所」（source = 'manual'）を最初に登録した人を spots.created_by に記録し、
-- その件数でスポット登録バッジ（1／3／5／10／20／30／50 件）を判定する。
--   1. 列を追加（退会で users が消えたら NULL にする）
--   2. 既存の manual スポットは「最も古い公開投稿の投稿者」で埋める
--   3. badges の CHECK に spot_registration:<閾値> を足す

-- 1. 列
alter table public.spots add column if not exists created_by uuid references public.users (id) on delete set null;
create index if not exists spots_created_by_idx on public.spots (created_by) where created_by is not null;

-- 2. 既存行の埋め合わせ（manual だけ。places 由来は「登録」ではない）
update public.spots s
  set created_by = p.user_id
  from (
    select distinct on (spot_id) spot_id, user_id
    from public.posts
    where status = 'published' and spot_id is not null
    order by spot_id, created_at asc
  ) p
  where s.id = p.spot_id
    and s.source = 'manual'
    and s.created_by is null;

-- 3. バッジ種別
alter table public.badges drop constraint if exists badges_type_check;
alter table public.badges
  add constraint badges_type_check check (
    badge_type ~ '^prefecture:.+$'
    or badge_type in (
      'post_count:1', 'post_count:10', 'post_count:50', 'post_count:100',
      'like_count:1', 'like_count:10', 'like_count:50', 'like_count:100', 'like_count:200',
      'spot_registration:1', 'spot_registration:3', 'spot_registration:5', 'spot_registration:10',
      'spot_registration:20', 'spot_registration:30', 'spot_registration:50'
    )
  );

notify pgrst, 'reload schema';

-- ---- 20260919000004_comment_replies ----
-- feedback-0919 Task4（v3.2）: コメントへの返信
-- 出典: docs/tasks/shared-ui/feedback-0919/04-comment-reply.md
--       要件定義書 v3.2 3.5.3・3.9.1・5.2・5.3「コメントの返信」
--
-- 【初心者向け】
--   - parent_id: 返信先のコメント（NULL＝最上位）。返信への返信も「直接の返信先」を入れる
--   - root_id  : そのやり取りの最上位コメント。一覧は「最上位 20 件＋その root_id の返信」で取るので、再帰せずに済む
--   - deleted_at: 返信がある親を消したときの論理削除（「削除されたコメント」の枠を残す）。返信が無ければ物理削除する
--   - 親と同じ投稿でなければならない（トリガーで検証）
--   - 通知種別 comment_replied を追加

alter table public.comments add column if not exists parent_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists root_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists deleted_at timestamptz;
create index if not exists comments_root_idx on public.comments (root_id, created_at) where root_id is not null;
create index if not exists comments_post_top_idx on public.comments (post_id, created_at desc) where parent_id is null;

-- 親と同じ投稿でなければ拒否し、root_id を親から引き継ぐ（親が最上位なら親自身）
create or replace function public.comments_set_root()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    new.root_id := null;
    return new;
  end if;
  select post_id, root_id into parent from public.comments where id = new.parent_id;
  if parent is null then
    raise exception 'parent comment not found';
  end if;
  if parent.post_id <> new.post_id then
    raise exception 'parent comment belongs to another post';
  end if;
  new.root_id := coalesce(parent.root_id, new.parent_id);
  return new;
end $$;

drop trigger if exists comments_set_root on public.comments;
create trigger comments_set_root
  before insert on public.comments
  for each row execute function public.comments_set_root();

-- 通知種別
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed',
    'comment_replied'
  ));

notify pgrst, 'reload schema';
