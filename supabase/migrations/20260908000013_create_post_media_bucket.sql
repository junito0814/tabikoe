-- F-PO-01 Task4: 投稿の写真・動画用Storageバケットの作成
-- 出典: docs/tasks/posts/post-creation/04-media-upload-integration.md
--       要件定義書5.4（保存先はSupabase Storage）
--
-- アイコン用のavatarsバケットと異なり、**非公開バケット**とする。
-- 投稿には公開／非公開の設定があり（3.3.6）、非公開投稿の写真が
-- URLを知っていれば誰でも取得できる状態は、その設定の意味を失わせるため。
-- 配信は署名付きURLで行い、post_photos.storage_urlにはバケット内のパスを保存する。

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do nothing;

-- 読み取り・書き込みともRoute Handlers（Service Role Key）経由で行うため、
-- authenticated向けのポリシーは追加しない。
-- 署名付きURLの発行時に投稿の公開範囲を判定する。
