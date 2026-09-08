# Task 3: 投稿詳細画面への遷移統合

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)
> インデックス: [pin-interaction](00-index.md)

## 依存

- [Task 2: 投稿カード一覧画面（SC-04）UI実装](02-post-list-ui.md)
- browsing/post-detail-view（投稿詳細画面SC-05。カテゴリ「browsing」で作成予定）

## 実装内容

- SC-04の投稿カードをタップすると、投稿詳細画面（SC-05）へ遷移するよう統合する

## 成果物

- SC-04からSC-05への遷移導線

## テスト要件

### 単体テスト
- 対象外（画面遷移の統合のみのため）

### 結合テスト
- 投稿カードタップから、対象投稿のSC-05へ正しく遷移することを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿一覧内の投稿カードをタップすると投稿詳細画面へ遷移すること
