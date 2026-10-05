-- #700: spots に place_id を足す（Google から保存してよい唯一の値）
-- 出典: 要件定義書 6.2「Google から借りるものの方針」、#690 の調査（PR #698）
--
-- 【初心者向け】Google Maps Platform の規約は、業者名・住所・クチコミをコピーして
-- 保存することを禁じている（本文 §3.2.3 (a)(iii)）。例外は Service Specific Terms §3 の
-- 「ID 値」だけで、place_id がそれにあたる。
--
-- place_id があると、営業時間や公式サイトを**その場で**引ける（保存しないで済む）。
-- #701 がこの列を鍵として使う。
--
-- NULL を許すのは次の 2 つがあるため。
--   1. 利用者が自分で登録した場所（source='manual'）には Google の ID が無い
--   2. この列を足す前に登録されたスポット（次に登録されるときまで NULL のまま）

alter table public.spots add column if not exists place_id text;

comment on column public.spots.place_id is
  'Google Places の Place ID。Google から保存してよい唯一の値（Service Specific Terms §3）。手動登録と、この列より前に作られたスポットは NULL';

-- #701 が place_id から引くときに使う。NULL の行は入れない（部分索引）
create index if not exists spots_place_id_idx on public.spots (place_id) where place_id is not null;
