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
