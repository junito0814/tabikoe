# Task 2: 投稿数・獲得いいね総数のサマリー集計 Route Handler

> 出典: [my-page.md](../../../user-stories/records/my-page.md)
> インデックス: [my-page](00-index.md)

## 依存

- post-creation [Task1: 投稿関連テーブルのスキーマ定義・マイグレーション](../../posts/post-creation/01-post-schema-migration.md)
- table-catalog [Task5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)

## 実装内容

- `GET /api/users/me/summary`を実装し、ログインユーザー自身の投稿数（非公開投稿を含む）と、投稿に対する累計いいね数を集計して返す
- 投稿数は`posts`テーブルの`user_id`一致件数、獲得いいね総数は当該ユーザーの投稿群に対する`likes`件数の合計とする

## 成果物

- `app/api/users/me/summary/route.ts`

## テスト要件

### 単体テスト
- 投稿数・獲得いいね総数の集計クエリが、非公開投稿を含めて正しく件数を返すことを検証する

### 結合テスト
- テスト用DBで、公開・非公開投稿を混在させたユーザーに対し、投稿数に非公開分が含まれることを確認する
- 複数投稿にまたがるいいねが正しく合算されることを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿数に非公開投稿が含まれること
