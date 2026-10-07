-- #754: 運営からのお知らせにも「読んだかどうか」を持たせる
--
-- ⚠ このファイルには **権限（grant）の書き忘れ** がありました。
--   そのままだと表は出来るのに誰も読み書きできません（permission denied）。
--   直しは 20261007000002_announcement_reads_grants.sql にあります。**両方当ててください。**
-- 出典: Issue #754「Bug 1: 運営からのお知らせに未読・既読が無い」
--       要件定義書 3.9.2（通知一覧）
--
-- 【初心者向け】個人向け通知（notifications）は **1 人に 1 行**あるので、その行に
-- `is_read` を持てた。いっぽうお知らせ（system_announcements）は **1 件を全員で共有**する
-- 作りで（宛先の列を持たない）、1 人が読んでも他の人の既読にできない。
--
-- そこで「**誰がどのお知らせを読んだか**」だけを持つ表を足す。
--   - 未読 ＝ この表に自分の行が**無い**こと
--   - 読んだら 1 行入れる／未読に戻すなら消す（is_read の true/false と同じ意味になる）

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

comment on table public.announcement_reads is
  '#754: 運営からのお知らせを誰が読んだか。行があれば既読、無ければ未読。system_announcements は全員で 1 行を共有するため、既読だけを別に持つ';

-- 「自分が読んだお知らせ」を引くので、user_id から辿る索引を足す（主キーは announcement_id が先頭）
create index if not exists announcement_reads_user_idx on public.announcement_reads (user_id);

alter table public.announcement_reads enable row level security;

-- 自分の既読だけを読み書きできる（他人が読んだかは分からない）
drop policy if exists announcement_reads_select_own on public.announcement_reads;
create policy announcement_reads_select_own on public.announcement_reads
  for select using (auth.uid() = user_id);

drop policy if exists announcement_reads_insert_own on public.announcement_reads;
create policy announcement_reads_insert_own on public.announcement_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists announcement_reads_delete_own on public.announcement_reads;
create policy announcement_reads_delete_own on public.announcement_reads
  for delete using (auth.uid() = user_id);

/*
 * 【初心者向け】ここからは**今いる利用者のための後始末**。
 *
 * この表を足した瞬間、**過去のお知らせがすべて未読**として積み上がります。
 * 昨日から使っている人にも「未読 12 件」と出てしまい、身に覚えがありません。
 *
 * 決めたこと（2026-10-06）: **「自分が登録した日より前に公開されたお知らせは読んだことにする」**。
 * 登録より前のものは、そもそもその人に向けて出したものではないためです。
 */
insert into public.announcement_reads (announcement_id, user_id, read_at)
select a.id, u.id, now()
from public.system_announcements a
join public.users u on a.published_at < u.created_at
on conflict do nothing;
