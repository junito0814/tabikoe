# Task 1: 投稿 API の検証変更（カテゴリ 7・日付必須・位置・状態）

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)
> インデックス: [post-creation-v3](00-index.md)

## 依存

- table-catalog-v3 Task 1

## 実装内容

- `validate-post-input.ts` を更新する：カテゴリは 7 値、`visited_at` は公開時に必須（未指定なら今日）、`lat`／`lng` は必須、`status` は `published`／`draft`
- `POST /api/posts`・`PATCH /api/posts/[id]` が `lat`／`lng`・`status`・`published_at` を保存する。下書き固有の扱いは draft ストーリーで行う
- 投稿一覧・詳細の取得（`post-cards.ts`・`post-detail.ts`）が `status = 'published'` だけを返すようにする

## 成果物

- `src/lib/posts/validate-post-input.ts`
- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/lib/posts/post-cards.ts`・`post-detail.ts`

## テスト要件

### 単体テスト
- カテゴリに旧値「イベント会場」を渡すと検証エラーになること
- 公開で `visited_at` 未指定なら今日が入り、未来日はエラーになること
- `lat`／`lng` 欠落が公開ではエラー、下書きでは許容されること

### 結合テスト
- `POST /api/posts` で作った投稿に lat／lng／published_at が保存されること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 日付の初期値が今日で、必須として扱われること（受入条件7）
