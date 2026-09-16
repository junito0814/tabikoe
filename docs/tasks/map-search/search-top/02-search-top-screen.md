# Task 2: 検索トップ画面（SC-00）

> 出典: [search-top.md](../../../user-stories/map-search/search-top.md)
> インデックス: [search-top](00-index.md)

## 依存

- Task 1
- theme Task 1
- menu-bar-v3 Task 1

## 実装内容

- `SearchTopScreen`：ロゴ、入力欄（「どこへ行く？」、300ms debounce で候補を種別ラベル付きに表示）、「近くのスポットを探す」、「いまいる場所に投稿する」（アクセント色の主要ボタン）。背景上部に空のグラデーション
- 未ログイン時はサービス説明一文とログインボタンだけ
- `/` の page.tsx を差し替える（signup-login-v3 Task 1 と同時）

## 成果物

- `src/components/search/SearchTopScreen.tsx`
- `src/components/search/DestinationInput.tsx`
- `src/app/page.tsx`

## テスト要件

### 単体テスト
- 3 要素だけが描画され、地図・一覧が無いこと
- 入力で候補が最大 8 件表示され、ラベルが付くこと
- 未ログイン時の描画

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ログイン後の着地点が検索トップで、行き先の入力欄・「近くのスポットを探す」・「いまいる場所に投稿する」の 3 つだけが表示されること（受入条件4）
