-- #892: 通報に「Jev の見立て」を持たせる（要件 6.8・ワイヤーフレーム決定事項 89）
--
-- 【初心者向け】なぜ保存するのか。
--   一覧を開くたびに Jev を呼ぶと、**1 画面で 20 回**呼ぶことになります。遅いし、お金もかかる。
--   それに「緊急度が高い順に並べる」は、**保存した値が無いと並べ替えられません**。
--   だから**通報が作られた瞬間に 1 回だけ**呼び、ここに入れておきます。
--
-- 【初心者向け】なぜ全部 null を許すのか。
--   Jev が落ちていても、**通報の受付は必ず成功させる**からです（要件 3.8.2）。
--   呼べなかった通報は null のまま残り、一覧では「―」と出ます。画面は壊れません。
alter table public.reports
  -- 0〜3。急いで対応すべきか（Score 型）
  add column if not exists jev_urgency numeric(4, 2),
  -- 通報理由の 8 択のうち、Jev が選んだもの（Choice 型）。reports.reason と同じ値の集合
  add column if not exists jev_reason text,
  -- 見立ての確信（0〜1）。低いときは画面に出さない
  add column if not exists jev_confidence numeric(4, 3),
  -- どの版のモデルが答えたか（あとで「あのときの判定」を説明できるように）
  add column if not exists jev_model text,
  -- 判定した時刻。null なら「まだ呼んでいない／呼べなかった」
  add column if not exists jev_evaluated_at timestamptz;

/*
 * 緊急度が高い順に並べるための索引（#903 で測った考え方と同じ）。
 *
 * 【初心者向け】`nulls last` を付けてあるのは、**判定できなかった通報を先頭に出さない**ため。
 * 未対応のものだけを見ることが多いので、状態も一緒に入れてあります。
 */
create index if not exists reports_jev_urgency_idx
  on public.reports (jev_urgency desc nulls last, created_at desc);
