-- admin-shell-dashboard Task 2: spots.created_at（ダッシュボードの「最近のスポット」用）
-- 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
--       要件定義書 3.10.3
--
-- 【初心者向け】spots には作った日時が無く、「最近のスポット」「今週のスポット」を出せなかった。
-- 列を足し、既存の行はそのスポットへの最初の投稿の日時で埋める（投稿が無ければ now()）。

alter table public.spots add column if not exists created_at timestamptz not null default now();

update public.spots s
set created_at = p.first_post_at
from (
  select spot_id, min(created_at) as first_post_at
  from public.posts
  group by spot_id
) p
where p.spot_id = s.id;

create index if not exists spots_created_at_idx on public.spots (created_at desc);
