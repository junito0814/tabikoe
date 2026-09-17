# Task 4: 動画（MP4／MOV）の受付と変換

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)
> インデックス: [post-creation-v3](00-index.md)

## 依存

- Task 1

## 実装内容

- `/api/posts/photos` で MP4 と MOV（`video/quicktime`）を受け付け、ファイルの実体を検証する（100MB・1 分以内）
- ffmpeg（`@ffmpeg-installer/ffmpeg` または `fluent-ffmpeg`）で先頭フレームのサムネイルを生成し、MOV は MP4 へ変換して保存する。位置情報メタデータを除去する
- Vercel のサーバーレス関数で ffmpeg が動くかを検証し、動かない場合は要件定義書 9 章 #8 の選択肢（Edge Functions／MP4 のみ）に従って PR で報告する
- `post_photos.media_type = 'video'`・`duration_seconds` を保存する

## 成果物

- `src/app/api/posts/photos/route.ts`
- `src/lib/video/process-video.ts`
- `package.json`（ffmpeg 依存）

## テスト要件

### 単体テスト
- MIME と拡張子の組み合わせ検証（MOV/MP4 のみ通す、1 分超は拒否）

### 結合テスト
- MP4 と MOV をアップロードし、サムネイルと MP4 本体が Storage に保存されること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 動画（MP4・MOV、100MBまで、1分以内）をアップロードでき、先頭フレームのサムネイルが自動生成され、MOV が MP4 に変換されて保存されること（受入条件35）
