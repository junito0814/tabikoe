# Task 3: 全体マップ画面（SC-02）UI実装

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display](00-index.md)

## 依存

- [Task 1: 「全体」タブ用ピン取得 Route Handler（/api/spots）](01-spots-fetch-handler.md)
- [Task 2: 「行きたい」タブ用ピン取得ロジック](02-wishlist-tab-integration.md)
- session-management [Task1: セッション検証Middlewareの実装](../../account/session-management/01-session-verification-middleware.md)

## 実装内容

- Google Maps JavaScript APIを組み込んだ地図コンポーネントを実装する（表示専用APIキー、使用元制限あり。6.1準拠）
- 「全体」「行きたい」タブの排他切り替えUIを実装する
- 初期表示位置を、位置情報の利用が許可されている場合は現在地、拒否された場合は東京駅周辺（緯度35.6812、経度139.7671）とする
- 同一エリアにピンが集中する場合のクラスタリング表示を実装する
- 未ログインユーザーがアクセスした場合、ログイン画面へ誘導する（session-management Task1のMiddlewareに準拠）
- 本コンポーネントは、マイマップ（F-RC-06）・スポット手動登録（SC-19）でも共通利用される前提で実装する（7.6保守性準拠）

## 成果物

- SC-02 全体マップ画面
- 共通地図コンポーネント（Google Maps JavaScript API組み込み）

## テスト要件

### 単体テスト
- タブ切り替え時、表示対象（全体／行きたい）が排他的に切り替わることを検証する
- 位置情報許可／拒否それぞれのケースで、初期表示位置が正しく決定されることを検証する

### 結合テスト
- テスト環境でTask1・2のAPIと接続し、実際のピンデータが地図上に描画されることを確認する
- 未ログイン状態でSC-02へアクセスするとログイン画面へ誘導されることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図上に現在地が表示され、位置情報が拒否された場合は東京駅周辺が初期表示されること
- 全体マップで「全体」「行きたい」タブが排他的に切り替わること
