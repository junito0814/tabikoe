# Task 1: 動画の直接アップロード（署名付きURL発行・バケット上限）

> 出典: 要件定義書 3.3.1・5.4
> インデックス: [video-upload](00-index.md)

## 依存

- post-creation [Task 4: 写真・動画アップロード処理の統合](../post-creation/04-media-upload-integration.md)（写真側の経路と `post-media` バケット）

## 実装内容

- `POST /api/posts/videos/upload-url` を実装する。`{ size, type }` を受け取り、規則外（100MB超・`video/mp4` 以外）は 400 で早期に弾き、`<userId>/<uuid>/video.mp4` への署名付きアップロードURL（`createSignedUploadUrl`）を返す
- ブラウザ側は `uploadToSignedUrl` で Supabase Storage へ直接アップロードする（本文が Vercel を経由しない）
- ブラウザ側の事前チェック: MIME タイプ・サイズ、`<video>` の `loadedmetadata` で再生時間（1分超は送らない）。いずれもサーバー側で再検証する
- `post-media` バケットに `file_size_limit = 100MB`・`allowed_mime_types = image/jpeg, image/png, video/mp4` を設定するマイグレーションを追加する

## 成果物

- `app/api/posts/videos/upload-url/route.ts`
- `src/lib/video/client-upload.ts`（ブラウザ側の一連の処理: URL 取得 → 直接アップロード → Task 2 の処理呼び出し）
- `supabase/migrations/20260915000001_post_media_video_limits.sql`

## テスト要件

### 単体テスト
- サイズ超過・MIME 不一致で URL を発行しないことを検証する（Route Handler の分岐）

### 結合テスト
- 発行した URL で本人のディレクトリ配下にのみアップロードできることを確認する
- Storage 側の上限（100MB・MIME）で規則外のファイルが拒否されることを確認する

### E2Eテスト
- なし（[Task 4](04-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 動画（MP4、1点あたり100MB以内、1分以内）を投稿に添付できること

## 補足

Supabase の Free プランはプロジェクト全体のアップロード上限が 50MB のため、そのままでは 50MB を超える動画は Storage 側で拒否される。要件の 100MB を満たすには Pro プランが必要（要件定義書 9章#7）。
