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
