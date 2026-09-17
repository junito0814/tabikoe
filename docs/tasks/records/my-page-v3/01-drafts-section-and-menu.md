# Task 1: 下書きの段と遷移メニューの変更

> 出典: [my-page.md](../../../user-stories/records/my-page.md)
> インデックス: [my-page-v3](00-index.md)

## 依存

- draft Task 3
- theme Task 3

## 実装内容

- `MyPageScreen` の 2 段目に下書き（`GET /api/users/me/drafts`。「下書き N 件」・最新 3 件・「続きを書く」→ `/posts/new?draft=`、削除）を、下書きがあるときだけ出す
- 遷移メニューを 行きたい／アルバム／マイマップ／バッジ の 4 つにし、しおりの導線を外す
- `my-page.ts` の投稿数から下書きを除外する

## 成果物

- `src/components/mypage/MyPageScreen.tsx`
- `src/components/mypage/DraftsSection.tsx`
- `src/components/mypage/MyPageMenu.tsx`
- `src/lib/users/my-page.ts`

## テスト要件

### 単体テスト
- 下書き 0 件で段が出ないこと
- メニューが 4 項目でしおりが無いこと
- 投稿数に下書きが含まれないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 下書きがあるとき先頭に「下書き N 件」と最新 3 件が表示され、「続きを書く」で SC-03 が開くこと（受入条件51）
