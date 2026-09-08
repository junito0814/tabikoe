-- F-PO-01 旅行タイトル Task2: 同一ユーザー内でのタイトル一意性をDB制約として担保する
-- 出典: docs/tasks/posts/trip-title/02-trip-resolution-logic.md
--       要件定義書3.3.4「一意性の範囲：同一ユーザー内でのみ一意」
--
-- 「トリム後の完全一致で既存旅行を探し、無ければ作成する」ロジックは、
-- 同一ユーザーの同時投稿で同じタイトルが重複作成されうる。
-- タイトルは常にトリム済みで保存する前提で、(user_id, title)に一意制約を張る。

alter table public.trips
  drop constraint if exists trips_user_title_unique;

alter table public.trips
  add constraint trips_user_title_unique unique (user_id, title);
