# F-PO-01 動画対応（video-upload） — タスク分割

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md) / 要件定義書 3.3.1・5.4・9章#5

post-creation [Task 4](../post-creation/04-media-upload-integration.md) のうち見送っていた動画（MP4）の半分を、独立したストーリーとして切り出したもの。写真の経路（`POST /api/posts/photos`・sharp）はそのまま残し、動画だけ別経路にする。

**受付形式（v2.9）**: MP4 に加え、iPhone 標準カメラが保存する MOV（QuickTime・HEVC）も受け付ける。保存形式は常に MP4（H.264／AAC）で、H.264/AAC 以外はサーバー側で再エンコードする。

**別経路にする理由**: Vercel の Route Handler はリクエスト本文が 4.5MB までで、要件の「1点あたり最大100MB」の動画本体を写真と同じ multipart で受け取れない。動画本体はブラウザから Supabase Storage へ署名付きURLで直接アップロードし、Route Handler は Storage 上のファイルを取り出して検証・処理する。

Task 1 と Task 2 は独立して着手でき、Task 3 が両方を投稿フォーム・投稿 API に組み込む。Task 4 は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [動画の直接アップロード（署名付きURL発行・バケット上限）](01-video-direct-upload.md) | post-creation Task4（写真側） |
| 2 | [動画の検証・メタデータ除去・サムネイル生成 Route Handler（ffmpeg）](02-video-processing-handler.md) | 要件定義書9章#5の検証 |
| 3 | [投稿作成・編集への動画の組み込み（フォーム・media 指定・削除・再生）](03-post-media-integration.md) | 1, 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
