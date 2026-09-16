# Task 4: 「変更」からの候補検索と地図連携

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)
> インデックス: [spot-selection-v3](00-index.md)

## 依存

- Task 1
- Task 2

## 実装内容

- スポット名欄の「変更」で `SpotAutocompleteInput` を開き、候補を選ぶと地図をそのスポットへ移動して `lockedPosition` にする。「新しい場所」を選ぶと固定を解除して中央固定ピンに戻る
- スポット名の任意入力（新しい場所の名前）欄を置く

## 成果物

- `src/components/posts/SpotField.tsx`
- `src/components/posts/PostComposeScreen.tsx`（連携）

## テスト要件

### 単体テスト
- 候補選択で地図の中心と固定状態が変わること
- 「新しい場所」で固定が解除されること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「変更」から名前で候補を検索して選ぶと、地図がそのスポットへ移動し位置が固定されること
