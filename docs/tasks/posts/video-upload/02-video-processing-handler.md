# Task 2: 動画の検証・メタデータ除去・サムネイル生成 Route Handler（ffmpeg）

> 出典: 要件定義書 5.4・9章#5
> インデックス: [video-upload](00-index.md)

## 依存

- 要件定義書9章#5「ffmpeg の Vercel サーバーレス関数上での動作検証」（本タスクの中で行う）

## 実装内容

- `POST /api/posts/videos` を実装する。`{ path }`（Task 1 が発行した本人配下のパス）を受け取り、Storage から動画を取り出して以下を行う
  - 実体の検証: 先頭の `ftyp` ボックスと brand で MP4 かどうかを判定（拡張子・Content-Type は信用しない）、100MB 以内
  - `ffmpeg -i` の出力から再生時間と映像ストリームの有無を読み、1分超・映像なしは拒否
  - `-map_metadata -1`（コンテナ・各ストリーム）で位置情報等のメタデータを除去し、`-c copy` で再エンコードせずに書き出す。`+faststart` で再生開始を早くする
  - 先頭フレームを 1 枚書き出し、sharp で長辺 1200px の JPEG にする（写真の縮小画像と同じ規則）
  - 処理済み動画で元のパスを上書きし、サムネイルを `<同じディレクトリ>/thumbnail.jpg` に保存する
  - 検証に失敗した場合はアップロードされたファイルを消す
- ffmpeg は `ffmpeg-static` の同梱バイナリを子プロセスで実行する。`next.config.ts` で `serverExternalPackages` に加え、`outputFileTracingIncludes` でバイナリを本ルートの成果物に含める
- 100MB のダウンロードと ffmpeg 実行を含むため `maxDuration = 300` を設定する

## 成果物

- `app/api/posts/videos/route.ts`
- `src/lib/video/mp4.ts`（純粋関数: MP4 判定・ffmpeg 出力の解釈）
- `src/lib/video/process-video.ts`（ffmpeg 実行・Storage 入出力）
- `next.config.ts` の設定

## テスト要件

### 単体テスト
- MP4 以外（QuickTime・JPEG・ランダムなバイト列）を実体で拒否することを検証する
- `ffmpeg -i` の出力から再生時間を正しく読むことを検証する
- **同梱 ffmpeg を実際に起動し**、生成した MP4 から「メタデータが除去された動画」と「長辺 1200px 以内の JPEG サムネイル」が得られること、1分超の動画が `video_too_long` で拒否されることを検証する（9章#5 のローカル検証を兼ねる）
- Route Handler が本人配下以外のパスを処理しないこと、検証エラーを 400／未アップロードを 404／内部エラーを 500 に写すことを検証する

### 結合テスト
- Vercel（Preview 環境）に配置した状態で、実機から 1 本アップロードし、処理が完了してサムネイルが表示されることを確認する（9章#5 の本番検証）

### E2Eテスト
- なし（[Task 4](04-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 動画の先頭フレームがサムネイルとして生成され、一覧・詳細で表示されること
- 動画の位置情報メタデータが除去された状態で保存・配信されること
