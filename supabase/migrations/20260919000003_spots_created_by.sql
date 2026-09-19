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
