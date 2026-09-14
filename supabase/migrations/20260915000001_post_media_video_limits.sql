-- F-PO-01 動画対応 Task1: post-media バケットの受付上限を動画に合わせる
-- 出典: docs/tasks/posts/video-upload/01-video-direct-upload.md
--       要件定義書5.4（動画は1点あたり最大100MB、MP4のみ）
--
-- 動画本体はブラウザから署名付きアップロードURLで直接 Storage に置かれるため、
-- Route Handler の検証より前に Storage 側でもサイズ上限を掛けておく。
-- 写真（10MB）は Route Handler 経由で先に検証しているので、ここでは動画の上限を採用する。
--
-- 注意: Supabase の Free プランはプロジェクト全体のアップロード上限が 50MB のため、
-- そのままでは 50MB 超の動画は Storage 側で拒否される（Pro プランで解除される）。

update storage.buckets
set file_size_limit = 104857600,           -- 100MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4']
where id = 'post-media';
