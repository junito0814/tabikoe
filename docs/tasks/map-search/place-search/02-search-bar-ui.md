# Task 2: 検索バーUI・地図移動ロジックの実装

> 出典: [place-search.md](../../../user-stories/map-search/place-search.md)
> インデックス: [place-search](00-index.md)

## 依存

- [Task 1: 地名検索 Route Handler（/api/geocode）](01-geocode-handler.md)
- map-display [Task3: 全体マップ画面（SC-02）UI実装](../map-display/03-map-screen-ui.md)

## 実装内容

- SC-02の地図上部に検索バーを設置する
- 入力された地名でTask1を呼び出し、返された緯度経度へ地図の表示位置を移動する
- 本機能は地図の移動のみを行い、投稿の絞り込み（post-filter）には影響しない

## 成果物

- 検索バーコンポーネントおよび地図移動ロジック

## テスト要件

### 単体テスト
- 検索結果の緯度経度を地図コンポーネントへ正しく渡すロジックを検証する

### 結合テスト
- Task1のAPIと接続し、地名入力から実際に地図が移動することを確認する
- 地名検索後、投稿の絞り込み条件（post-filter側の状態）が変化しないことを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地名検索でエリアを移動できること
- 地名検索は地図の移動のみを行い、投稿の検索・絞り込み結果には影響しないこと
