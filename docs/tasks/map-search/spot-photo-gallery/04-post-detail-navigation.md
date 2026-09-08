# Task 4: タップ時の元投稿詳細への遷移統合

> 出典: [spot-photo-gallery.md](../../../user-stories/map-search/spot-photo-gallery.md)
> インデックス: [spot-photo-gallery](00-index.md)

## 依存

- [Task 2: スポット写真一覧画面（SC-13）UI実装](02-gallery-screen-ui.md)
- browsing/post-detail-view（投稿詳細画面SC-05。カテゴリ「browsing」で作成予定）

## 実装内容

- SC-13で写真・動画をタップすると、それを含む元の投稿の詳細画面（SC-05）へ遷移するよう統合する

## 成果物

- SC-13からSC-05への遷移導線

## テスト要件

### 単体テスト
- 対象外（画面遷移の統合のみのため）

### 結合テスト
- グリッド内の写真・動画をタップし、対応する元投稿のSC-05へ正しく遷移することを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 写真・動画をタップすると元の投稿詳細画面へ遷移すること
