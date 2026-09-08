# Task 2: アルバムメンバー一覧の表示

> 出典: [album.md](../../../user-stories/records/album.md)
> インデックス: [album](00-index.md)

## 依存

- table-catalog [Task2: album_members テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/02-album-members-table.md)

## 実装内容

- `GET /api/trips/{id}/members`を実装し、当該旅行の`album_members`をロール（オーナー／編集者／閲覧者）とともに一覧取得する
- メンバーのユーザー名・アイコンを`users`テーブルと結合して返す
- 招待受諾によるメンバー追加、権限変更、削除は `album-collaboration`カテゴリ（F-RC-03）側で実装する。本タスクは一覧表示のみを対象とする

## 成果物

- `app/api/trips/[id]/members/route.ts`（GET）

## テスト要件

### 単体テスト
- `album_members`のレコードが、ロールとユーザー情報を伴って正しく整形されることを検証する

### 結合テスト
- テスト用DBで、複数ロールのメンバーが登録された旅行に対し、全メンバーがロールとともに取得できることを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- アルバム画面に、当該旅行の投稿・写真・動画・メンバー一覧が表示されること
