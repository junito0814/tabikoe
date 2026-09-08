# Task 2: 写真・動画の個別編集（追加・削除）ロジック

> 出典: [post-edit.md](../../../user-stories/posts/post-edit.md)
> インデックス: [post-edit](00-index.md)

## 依存

- [Task 1: 投稿編集 Route Handler（PATCH /api/posts/{id}）](01-post-edit-handler.md)
- post-creation [写真・動画アップロード処理の統合](../post-creation/04-media-upload-integration.md)

## 実装内容

- 既存の`post_photos`レコードを個別に削除できるエンドポイント（例：`DELETE /api/posts/{id}/photos/{photoId}`）を実装する
- 新規の写真・動画追加は、post-creationで実装した画像・動画処理を再利用する（枚数上限なし）
- 削除・追加後、`display_order`を整合性が取れるよう再計算する
- 削除された写真・動画は、Supabase Storageからも削除する

## 成果物

- 投稿写真・動画の個別削除・追加エンドポイント

## テスト要件

### 単体テスト
- 削除対象が投稿者本人の投稿に属することを検証するロジックを検証する
- 削除後の`display_order`再計算ロジックを検証する

### 結合テスト
- テスト用DB・Storageに対し、実際に写真・動画を削除するとレコードとファイルの両方が削除されることを確認する
- 新規追加後、既存の写真・動画と合わせて`display_order`が矛盾なく採番されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 写真・動画を個別に削除・追加でき、枚数上限がないこと
