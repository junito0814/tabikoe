# Task 3: 旅行タイトル編集（アルバム名変更）Route Handler

> 出典: [trip-title.md](../../../user-stories/posts/trip-title.md)
> インデックス: [trip-title](00-index.md)

## 依存

- post-creation [投稿関連テーブルのスキーマ定義・マイグレーション](../post-creation/01-post-schema-migration.md)

## 実装内容

- `PATCH /api/trips/{id}`を実装する
- 当該旅行のオーナー（＝作成者）のみ変更可能とする
- 変更すると、その旅行IDに紐づく全投稿の表示名（旅行タイトル）に反映される（`trips.title`を更新するだけで、投稿側は参照のため自動的に反映される設計とする）

## 成果物

- `app/api/trips/[id]/route.ts`（PATCH）

## テスト要件

### 単体テスト
- オーナー以外のユーザーからの変更リクエストが拒否されることを検証する

### 結合テスト
- テスト用DBで`trips.title`を更新し、当該旅行に紐づく投稿を取得すると新しいタイトルが反映されていることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- オーナーが旅行タイトルを変更すると、紐づく全投稿の表示名に反映されること
