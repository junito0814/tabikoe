# Task 3: スポット行の UI（時刻・メモ・並び替え・削除）

> 出典: [arrival-time.md](../../../user-stories/itinerary/arrival-time.md)
> インデックス: [arrival-time](00-index.md)

## 依存

- Task 1
- Task 2
- itinerary-basics Task 3

## 実装内容

- `ItinerarySpotRow`：番号、時刻（TimePicker10）、スポット名、メモ（インライン編集）、「投稿一覧」「投稿する」、Day ドロップダウン、上下ボタン（パソコンはドラッグ。時刻の無い行のみ）、削除
- チェックボックスの枠（中身は itinerary-check Task 3）

## 成果物

- `src/components/itineraries/ItinerarySpotRow.tsx`

## テスト要件

### 単体テスト
- 時刻がある行で上下ボタンが無効になること
- メモの保存が API を呼ぶこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 時刻の無いスポットが末尾にまとまり、上下ボタン（パソコンではドラッグ）で順番を変えられること
