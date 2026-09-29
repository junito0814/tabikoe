-- strike-system Task 3: 自動非公開（異なる通報者 3 人）
-- 出典: docs/tasks/safety/strike-system/03-auto-hide.md
--       要件定義書 3.10.8「自動で行う対応」・3.8.1
--
-- 【初心者向け】タスク文書では auto_hidden_at という別の列を足す案だったが、hidden_at を見て隠している場所が
-- 20 か所以上（RLS を含む）あり、全部に or 条件を足すと漏れが出る。そこで「隠す」のは今までどおり hidden_at、
-- 「誰の判断か」は hidden_reason で区別する（'auto' ＝ 自動。'moderation' ＝ 通報対応、'suspension' ＝ 停止）。
-- 「問題なし」で戻すときは hidden_reason = 'auto' の行だけ hidden_at を消す。コメントにも同じ列を足す。

alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

alter table public.comments add column if not exists hidden_reason text;
alter table public.comments drop constraint if exists comments_hidden_reason_check;
alter table public.comments add constraint comments_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

create index if not exists posts_hidden_reason_idx on public.posts (hidden_reason) where hidden_reason is not null;
create index if not exists comments_hidden_reason_idx on public.comments (hidden_reason) where hidden_reason is not null;
