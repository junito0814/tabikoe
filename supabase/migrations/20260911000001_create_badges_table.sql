-- data-model/table-catalog Task4: badges テーブルの作成
-- 出典: docs/tasks/data-model/table-catalog/04-badges-table.md
--       要件定義書3.7（都道府県バッジ・投稿数バッジ・いいね数バッジ）
--
-- badge_type は「種別:レベル」の1列で表す（タスク仕様が単一列を指定しているため）。
--   prefecture:<都道府県名>   例: prefecture:沖縄県
--   post_count:<閾値>         1 / 10 / 50 / 100
--   like_count:<閾値>         1 / 10 / 50 / 100 / 200
-- 閾値は3.7で確定しているためCHECK制約で固定し、判定ロジック側の誤りが
-- 不正なレベルとして混入しないようにする（postsの入力規則と同じ考え方）。
--
-- 獲得済みバッジは投稿削除で条件を下回っても失われない（3.7）。
-- そのため投稿・いいねとは外部キーで結ばず、獲得時にINSERTするだけの独立した記録にする。

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  badge_type text not null,
  acquired_at timestamptz not null default now(),
  constraint badges_user_type_unique unique (user_id, badge_type),
  constraint badges_type_check check (
    badge_type ~ '^prefecture:.+$'
    or badge_type in (
      'post_count:1', 'post_count:10', 'post_count:50', 'post_count:100',
      'like_count:1', 'like_count:10', 'like_count:50', 'like_count:100', 'like_count:200'
    )
  )
);

alter table public.badges enable row level security;

-- 本人は自分の獲得済みバッジを閲覧できる（SC-10）。付与はRoute Handlers（service_role）が行う
drop policy if exists "badges_select_own" on public.badges;
create policy "badges_select_own"
  on public.badges
  for select
  to authenticated
  using (auth.uid() = user_id);

grant all privileges on table public.badges to service_role;
grant select on table public.badges to authenticated;
