# Task 2: 仮タイトルの付け直し促し

> 出典: [my-page.md](../../../user-stories/records/my-page.md)
> インデックス: [my-page-v3](00-index.md)

## 依存

- trip-title-v3 Task 2

## 実装内容

- `MyPostsList` で仮タイトル（「今日の投稿（M/D）」）の旅行に「タイトルを付ける」の促しを出し、タップで旅行タイトル変更（`PATCH /api/trips/[id]`）のダイアログを開く

## 成果物

- `src/components/mypage/MyPostsList.tsx`
- `src/components/trips/RenameTripDialog.tsx`

## テスト要件

### 単体テスト
- 仮タイトルの投稿にだけ促しが出ること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 仮タイトル「今日の投稿（M/D）」のままの投稿に付け直しを促す表示が出ること
