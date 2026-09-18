# Task 1: 用語の統一と細かな文言・表示の変更

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- なし（他のタスクより先に行う）

## 実装内容

- 画面の文言を統一する：「旅行タイトル」→「アルバム」（投稿画面の入力欄名・マイページの絞り込み・しおり作成・保存先シート）、「マイマップ」→「あしあと」（マイページのメニュー・SC-12 の見出し）、「近くの声」→「近くのスポット」（探すモード）、「いまいる場所に投稿する」→「ここを投稿」（検索トップ）、しおりの「未定」→「ALL」の準備として「日付なし」（Day ドロップダウン・保存先シートの Day 選択）
- 検索トップ（SC-00）の下の案内文（「さがす ・ 近くを見る ・ ここに投稿」）を削除する
- 行きたい（SC-08）の「解除」を文字ではなくゴミ箱マーク（aria-label「〈スポット名〉の保存を解除」）にする
- マイページの下書きの段を「3 件＋『すべて見る』（4 件以上のとき）」にし、下書き一覧ページ `/mypage/drafts` を用意する
- テストの期待文言も同時に直す

## 成果物

- `src/components/search/SearchTopScreen.tsx`
- `src/components/map/NearbyVoices.tsx`
- `src/components/mypage/MyPageMenu.tsx`・`MyPageScreen.tsx`・`DraftsSection.tsx`・`MyPostsList.tsx`
- `src/app/mypage/drafts/page.tsx`（新設）
- `src/components/map/MyMapScreen.tsx`
- `src/components/wishlist/WishlistScreen.tsx`
- `src/components/posts/PostFormFields.tsx`・`TripTitleInput.tsx`（ラベル）
- `src/components/itineraries/*`・`src/components/save/SaveSheet.tsx`（「未定」→「日付なし」）

## テスト要件

### 単体テスト
- 旧文言（「旅行タイトル」「マイマップ」「近くの声」「いまいる場所に投稿する」「未定」）が描画に含まれないこと（各画面のテスト）
- 下書きが 4 件以上のとき「すべて見る」が出て、3 件以下では出ないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「旅行タイトル」「マイマップ」「近くの声」「いまいる場所に投稿する」「未定」の文言が画面のどこにも出ないこと
