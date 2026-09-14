# Task 3: 投稿作成・編集への動画の組み込み（フォーム・media 指定・削除・再生）

> 出典: 要件定義書 3.3.1・3.3.3・4.5.1
> インデックス: [video-upload](00-index.md)

## 依存

- [Task 1: 動画の直接アップロード](01-video-direct-upload.md)
- [Task 2: 動画の検証・処理 Route Handler](02-video-processing-handler.md)

## 実装内容

- 投稿作成 `POST /api/posts`・写真追加 `POST /api/posts/[id]/photos` の入力を `media: [{ mediaType, storagePath, videoPath?, durationSeconds? }]` に拡張し、`post_photos` に `media_type`・`video_url`・`duration_seconds` を保存する。旧形式 `photoPaths` も引き続き受け付ける
- 紐づけるパスは本人のディレクトリ（`<userId>/`）配下に限定する（他人の非公開ファイルを自分の公開投稿に紐づけて署名付きURLで取り出す抜け道を塞ぐ）
- 投稿フォーム（SC-03）のファイル選択に `video/mp4` を加え、写真は従来どおり一括、動画は 1 本ずつ Task 1 → Task 2 の順で処理し、選択順を保って `media` に並べる。処理中は進捗を表示する
- 編集画面の既存メディア一覧で動画に「動画」の印を付ける（サムネイルは `storage_url`）
- 投稿削除・メディア個別削除で、サムネイルに加えて動画本体（`video_url`）も Storage から消す
- 投稿詳細（SC-05）・スポット写真一覧（SC-13）で、動画本体も署名付きURLで配信する（非公開バケットのため）

## 成果物

- `src/lib/posts/media-input.ts`（入力検証・行変換）
- `PostForm` の変更、`/posts/[id]/edit` の変更
- 各 Route Handler・`post-detail.ts`・`spot-photos.ts` の変更

## テスト要件

### 単体テスト
- 写真と動画が混在した `media` を順序を保って `post_photos` の行に変換できることを検証する
- 他人のディレクトリ配下・`..` を含むパスを拒否することを検証する
- 旧形式 `photoPaths` を引き続き受け付けることを検証する

### 結合テスト
- 動画を含む投稿を作成し、投稿詳細でサムネイルが出て、タップで再生できることを確認する
- 動画を含む投稿を削除し、サムネイル・本体の両方が Storage から消えることを確認する

### E2Eテスト
- なし（[Task 4](04-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 写真・動画を混在させて投稿でき、選択順に表示されること
- 投稿削除時に動画本体も削除されること
