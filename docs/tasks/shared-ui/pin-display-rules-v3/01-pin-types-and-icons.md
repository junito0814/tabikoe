# Task 1: ピン種別の拡張とアイコン

> 出典: [pin-display-rules.md](../../../user-stories/shared-ui/pin-display-rules.md)
> インデックス: [pin-display-rules-v3](00-index.md)

## 依存

- theme Task 3

## 実装内容

- `pin-type.ts` の種別を `post`（青の丸）・`saved`（赤のひし形）・`posted`（青の丸＋チェック）・`draft`（灰の破線の丸）・`focus`（青の丸＋淡い輪）・`numbered`（Day の色＋番号、済みは灰）・`cluster` に拡張する
- `pin-marker-icon.ts` で各種別の SVG（Google Maps の `icon` 用 data URL）を生成する。`numbered` は番号と Day 色、済みフラグを引数に取る
- 優先順位の解決関数（SC-02：saved ＞ post、SC-12：posted ＞ saved）を用意する

## 成果物

- `src/components/map/pin-type.ts`
- `src/components/pins/pin-marker-icon.ts`
- `src/components/pins/PinIcon.tsx`

## テスト要件

### 単体テスト
- 7 種別すべてで SVG が生成され、色が theme の変数から解決されること
- 優先順位関数が仕様どおりの種別を返すこと（saved＋post → saved、posted＋saved → posted）

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図にタブが無く、青・赤・灰の破線のピンが同時に表示され、凡例が常時表示されること（受入条件47）
