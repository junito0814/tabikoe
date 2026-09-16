# Task 2: 凡例コンポーネント

> 出典: [pin-display-rules.md](../../../user-stories/shared-ui/pin-display-rules.md)
> インデックス: [pin-display-rules-v3](00-index.md)

## 依存

- Task 1

## 実装内容

- `MapLegend`（青＝みんなの投稿・赤＝保存済み・灰の破線＝下書き。しおり表示時は Day の色）を作り、地図の左下または上部に常時表示する
- 色だけでなく形状（丸／ひし形／破線）で区別できるアイコンを使う

## 成果物

- `src/components/map/MapLegend.tsx`

## テスト要件

### 単体テスト
- 表示状態（通常／しおり）に応じて項目が切り替わること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図にタブが無く、青・赤・灰の破線のピンが同時に表示され、凡例が常時表示されること（受入条件47）
