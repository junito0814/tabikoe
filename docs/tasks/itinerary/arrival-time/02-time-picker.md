# Task 2: 10 分刻みの時刻ピッカー部品

> 出典: [arrival-time.md](../../../user-stories/itinerary/arrival-time.md)
> インデックス: [arrival-time](00-index.md)

## 依存

- theme Task 3

## 実装内容

- `TimePicker10`：時（0〜23）と分（00／10／…／50）の 2 列を回す自前のピッカー（`<input type=time>` は使わない）。クリアできる。キーボード操作対応

## 成果物

- `src/components/ui/TimePicker10.tsx`

## テスト要件

### 単体テスト
- 分の選択肢が 6 個であること
- クリアで null になること
- キーボードで選べること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりのスポットに 10 分刻みの到着予定時刻を設定でき、時刻のあるスポットが Day 内で時刻順に自動で並ぶこと（受入条件59）
