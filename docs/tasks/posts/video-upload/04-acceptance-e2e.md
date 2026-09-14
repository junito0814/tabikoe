# Task 4: 受入テスト（E2E）

> インデックス: [video-upload](00-index.md)

## 依存

- [Task 1](01-video-direct-upload.md)・[Task 2](02-video-processing-handler.md)・[Task 3](03-post-media-integration.md)

## 実装内容

- 動画を含む投稿の作成から表示・再生・削除までを通しで確認する E2E シナリオを作成・実行する

## 成果物

- E2E テストシナリオ（手動 or 自動、Playwright 等）
- 検証結果の記録（Vercel 上での ffmpeg 実行時間を含む）

## テスト要件

### E2Eテスト
1. 1分以内・100MB以内の MP4、および iPhone で撮影した MOV（HEVC）を写真と混在させて投稿する
   - 投稿詳細で選択順に並び、動画のサムネイルに再生アイコンが重なり、タップで再生できること（iPhone の MOV は Chrome／Android でも再生できること）
2. 1分を超える MP4 を選ぶ
   - 送信前にエラーが表示され、アップロードされないこと
3. 拡張子だけ `.mp4` に変えた画像ファイルを選ぶ
   - 処理時に拒否され、投稿に紐づかないこと
4. 動画を含む投稿を削除する
   - Storage からサムネイル・本体の両方が消えること

## 関連する受入条件

- 本ストーリーの受入条件すべて
