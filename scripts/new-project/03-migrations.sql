-- #896: 新しい Supabase プロジェクトを作るための SQL（3 / 3）
-- supabase/migrations/ を順につないだもの。**手で編集しない**（node scripts/build-new-project-sql.mjs で作り直す）
--
-- 【初心者向け】使い方:
--   新しいプロジェクトの SQL Editor に、01 から順に貼って実行する。
--   **順番が大事**（先に作った表に、あとから列・権限・ポリシーを足しているため）。
--   途中でエラーが出たらそこで止めて、出た文言をそのまま伝えること。先へ進まない。
--
-- この回に入っているもの（2 本）:
--   20261017000002_avatars_bucket_limits_apply.sql
--   20261107000001_spots_place_id_unique.sql

-- ======================================================================
-- 20261017000002_avatars_bucket_limits_apply.sql
-- ======================================================================
-- #899: avatars バケットにも、大きさ上限と受付形式を掛ける
-- 出典: Issue #899、要件定義書 5.4
--       前の判断: 20261009000002_avatars_bucket_limits.sql（#896。「いまは制限しない」と書き残したもの）
--
-- 【初心者向け】なぜ前の判断をひっくり返すのか。
--
--   #896 では「アイコンは Route Handler（/api/users/me/avatar）を通してしか保存されないので、
--   アプリ側で既に守られている」として、バケット側は制限なし（null）のままにした。
--   その判断は**いまも正しい**。これは「間違いを直す」のではなく、**守りを二重にする**話。
--
--   いま安全なのは「**ブラウザから Storage へ直接上げる道が無い**」という前提に依っている。
--   写真（post-media）には署名付き URL の道があるが、アイコンには用意していない。
--   将来アイコンにも同じ道を使う日が来たとき、**バケット側の制限が最後の砦**になる。
--
--   もう 1 つは**不揃いを消すこと**。post-media には 100MB・4 形式が入っているのに
--   avatars だけ制限なしだと、読んだ人に「なぜ？」を考えさせる（#896 がまさにその問いだった）。
--
-- 値は src/lib/image/process-upload.ts と**必ず揃える**。
--   MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  → 10485760
--   ALLOWED_FORMATS     = { jpeg, png }     → image/jpeg, image/png
-- ずれると「アプリは通すのに Storage が弾く」（またはその逆）が起き、原因が分かりにくい。
--
-- 既にある行がこの制限に収まるか:
--   Route Handler は 10MB を超える入力を 400 で断り、さらに**sharp で作り直してから**保存する
--   （1200px に縮め、JPEG か PNG にし直す）。つまり**保存されているのは作り直したあとの小さいもの**で、
--   入力の 10MB より大きくなることはない。形式も image/jpeg か image/png のどちらかしかない。
--   開発用（tabikoe-dev）の avatars は 2026-10-17 時点で **0 件**だったため、実データでは確かめられていない。
--   **本番に当てる前に、本番の avatars を一覧して 10MB 超と JPEG/PNG 以外が無いことを確かめる**こと。
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'avatars';

-- ======================================================================
-- 20261107000001_spots_place_id_unique.sql
-- ======================================================================
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
