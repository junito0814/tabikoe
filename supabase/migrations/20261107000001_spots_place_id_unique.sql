-- #1062: 同じ Place ID のスポットを 2 つ作らせない（一意の制約）
-- 出典: Issue #1062（Google の候補を選んでも、50m 以内にある別の店に置き換わる）
--       要件定義書 3.3.5「重複登録の防止」
--
-- 【初心者向け】なぜ要るのか。
--   #1062 で、Google の候補を登録するときの重複の判断を「50m 以内」から「同じ Place ID」に変えた
--   （src/lib/spots/registration-decision.ts）。画面側で「同じ Place ID は無い」と判断しても、
--   同じ場所の登録が**同時に** 2 本来ると、どちらも作りに行ってしまう。
--   最後の砦として、データベースに「同じ Place ID は 1 行だけ」と決めさせる。
--   断られた方は、POST /api/spots が先にできた方を返す。
--
-- NULL（手動登録と、#700 より前に作られたスポット）は何行あってもよいので、部分索引にする。
--
-- 【当てる前に】同じ Place ID が既に 2 行以上あると、この索引は作れずに止まる（データは壊れない）。
-- 先に次で確かめ、0 行であることを見てから当てる。
--   select place_id, count(*) from public.spots
--   where place_id is not null group by place_id having count(*) > 1;
-- 開発用の DB は 2026-11-07 に確かめて 0 組。

create unique index if not exists spots_place_id_unique on public.spots (place_id) where place_id is not null;

-- 一意の索引は、Place ID での検索にもそのまま使える。前の普通の索引（#700）は役目が重なるので外す
drop index if exists public.spots_place_id_idx;
