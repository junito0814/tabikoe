# Task 5: 地図読み込み障害時のエラー表示統合

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display](00-index.md)

## 依存

- [Task 3: 全体マップ画面（SC-02）UI実装](03-map-screen-ui.md)
- shared-ui/error-display [Task2: 各外部サービス障害時のエラーメッセージ組み込み](../../shared-ui/error-display/02-service-specific-error-integration.md)

## 実装内容

- Google Maps JavaScript APIの読み込みに失敗した場合、shared-ui/error-displayの共通コンポーネントを用いて地図エリアに「地図を読み込めませんでした」と表示する（6.1準拠）

## 成果物

- SC-02における地図読み込み障害時のエラー表示統合

## テスト要件

### 単体テスト
- 対象外（表示ロジックはshared-ui/error-displayで検証済み。本タスクは組み込み箇所の確認に限る）

### 結合テスト
- Google Maps JavaScript APIの読み込みを失敗させ（モック）、規定のエラーメッセージが地図エリアに表示されることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- なし（地図障害時のエラーメッセージ自体の受入条件はshared-ui/error-displayストーリーで管理する）
