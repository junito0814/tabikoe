# Task 3: 表示情報削減スタイルの適用と検証

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display-v3](00-index.md)

## 依存

- theme Task 2

## 実装内容

- `GoogleMap` に `map-styles.ts` のスタイルを適用し、`/dev/preview` でズーム 14／16 の前後スクリーンショットを撮って POI 非表示・道路名の出し分けを確認する
- 3D・建物・ストリートビュー・地図タイプ切替のコントロールを無効化する

## 成果物

- `src/components/map/GoogleMap.tsx`
- `docs/tasks/map-search/map-display-v3/screenshots/`（前後比較）

## テスト要件

### 単体テスト
- `mapOptions` に `styles`・`disableDefaultUI` 系の設定が含まれること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図上に Google マップの店舗ラベルが表示されず、駅名と地名は表示されること（受入条件69）
