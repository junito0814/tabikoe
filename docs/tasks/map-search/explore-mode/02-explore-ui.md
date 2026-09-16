# Task 2: 探すモード UI

> 出典: [explore-mode.md](../../../user-stories/map-search/explore-mode.md)
> インデックス: [explore-mode](00-index.md)

## 依存

- Task 1
- map-display-v3 Task 2
- search-top Task 4

## 実装内容

- `/map?mode=explore` で `MapScreen` の下 1/3 に `NearbyVoices`（横スクロールのカード、「徒歩圏 ▾」で半径切替）を出す。現在地を中心に開く
- カードのスクロール位置に応じて対応ピンを `focus` にする。カードのタップで `/posts/[id]`
- 位置情報拒否時はこの画面を開かず検索トップへ戻す

## 成果物

- `src/components/map/NearbyVoices.tsx`
- `src/components/map/MapScreen.tsx`（explore モード）

## テスト要件

### 単体テスト
- 半径切替で API が再呼び出しされること
- カード切替でフォーカスピンが変わること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- カードを横にめくると地図のピンが連動して強調されること
