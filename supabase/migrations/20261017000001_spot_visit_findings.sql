-- #929: 「行ってわかったこと」（spot_visit_findings）
-- 出典: Issue #929、要件定義書 4.5.19・3.3.1・3.4.2、ワイヤーフレーム決定事項 99
--
-- 【初心者向け】スポットごとに「行った人にしか分からないこと」を **1 人 1 スポット** で持つ。
-- 1 人が複数のことを選べるので、**選んだ項目ごとに 1 行**にして、主キーを (spot_id, user_id, finding) にする。
-- こうすると
--   ・スポット画面の「ペットと入れた 3 件」は group by で数えるだけ
--   ・「いつの報告か」は max(reported_at) で出せる
--   ・同じ人が 2 回選んでも 1 行にしかならない
-- 「まだあった」報告（spot_status_reports）と同じ考え方で、投稿ではなく**スポット**に付く。
--
-- **項目の一覧（finding に入る値）に CHECK を付けていない。**
-- 要件 4.5.19 の「属性を 1 つ足すのに 1 行で済む」を守るため。値の正しさは、
-- 入れる手前（src/lib/spots/visit-findings.ts の一覧）で確かめる。ここに書くと、
-- 項目を 1 つ足すたびにマイグレーションが要る。

create table if not exists public.spot_visit_findings (
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  finding text not null,
  reported_at timestamptz not null default now(),
  primary key (spot_id, user_id, finding)
);

-- スポット画面で「項目ごとの件数と、いちばん新しい報告」を出すための索引
create index if not exists spot_visit_findings_spot_finding_idx
  on public.spot_visit_findings (spot_id, finding, reported_at desc);

alter table public.spot_visit_findings enable row level security;

drop policy if exists "spot_visit_findings_select_all" on public.spot_visit_findings;
create policy "spot_visit_findings_select_all"
  on public.spot_visit_findings for select to authenticated
  using (true);

drop policy if exists "spot_visit_findings_owner_write" on public.spot_visit_findings;
create policy "spot_visit_findings_owner_write"
  on public.spot_visit_findings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all privileges on table public.spot_visit_findings to service_role;
grant select, insert, update, delete on table public.spot_visit_findings to authenticated;
