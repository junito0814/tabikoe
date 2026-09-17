# Task 2: ダークモードの変数と Google マップのダークスタイル

> 出典: [theme.md](../../../user-stories/shared-ui/theme.md)
> インデックス: [theme](00-index.md)

## 依存

- Task 1

## 実装内容

- `@media (prefers-color-scheme: dark)` で同じ変数を夜空の値（下地 `#0B1220`、面 `#161E2B`、文字 `#E6EDF5`、アクセント `#5AA2F0`、保存済み `#F06B72`、完了 `#4CAF7D`、グラデーション `#0E1E3D` → `#0B1220`）で再定義する。アプリ内の切替は設けない
- `src/components/map/map-styles.ts` にライト用（POI 非表示・駅名残す・道路名はズーム 16 以上・彩度低減）とダーク用の `google.maps.MapTypeStyle[]` を定義し、`GoogleMap.tsx` が `matchMedia('(prefers-color-scheme: dark)')` に応じて切り替える（3D・建物・ストリートビューは無効）
- `<meta name="color-scheme" content="light dark">` を layout に追加する

## 成果物

- `src/app/globals.css`（dark ブロック）
- `src/components/map/map-styles.ts`
- `src/components/map/GoogleMap.tsx`（styles 適用）

## テスト要件

### 単体テスト
- `matchMedia` をモックし、ダーク時にダーク用スタイル配列が渡されることを検証する
- スタイル配列に POI ラベル非表示・道路名のズーム条件が含まれることを検証する

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図上に Google マップの店舗ラベルが表示されず、駅名と地名は表示されること（受入条件69）
