# Task 1: 中央固定ピン地図コンポーネント

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)
> インデックス: [spot-selection-v3](00-index.md)

## 依存

- theme Task 2
- pin-display-rules-v3 Task 1

## 実装内容

- `ManualSpotRegistrationModal` から地図部分を `PostLocationMap`（中央固定ピン・現在地ボタン・初回案内・`onCenterChange`）として切り出す。`GoogleMap` を再利用し、既存スポット選択時は `lockedPosition` でピンを固定する
- 初期位置は props（lat/lng）または現在地、拒否時は東京駅周辺＋案内文
- モーダル `ManualSpotRegistrationModal` とその導線を削除する

## 成果物

- `src/components/posts/PostLocationMap.tsx`
- `src/components/spots/ManualSpotRegistrationModal.tsx`（削除）

## テスト要件

### 単体テスト
- 地図の中心変更で `onCenterChange` が呼ばれること
- `lockedPosition` があるとき中心変更で位置が変わらないこと
- 位置情報拒否時に東京駅周辺と案内文になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- スポット手動登録モーダル（SC-19）への導線がどこにも残っていないこと
