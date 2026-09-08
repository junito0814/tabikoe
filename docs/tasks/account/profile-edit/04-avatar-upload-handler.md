# Task 4: アイコン画像アップロード Route Handler実装

> 出典: [profile-edit.md](../../../user-stories/account/profile-edit.md)
> インデックス: [profile-edit](00-index.md)

## 依存

- [Task 3: 画像アップロード共通処理（EXIF除去・向き補正・縮小画像生成）の実装](03-image-upload-processing-common.md)
- F-AC-02 [セッション検証Middlewareの実装](../session-management/01-session-verification-middleware.md)

## 実装内容

- アイコン画像アップロード用のエンドポイント（例：`POST /api/users/me/avatar`）を実装する
- Task3の共通処理を呼び出し、処理済み画像（縮小画像）のURLを`users.avatar_url`に保存する
- 認証済みユーザー本人のアイコンのみ更新可能とする

## 成果物

- `app/api/users/me/avatar/route.ts`

## テスト要件

### 単体テスト
- アップロードされたファイルに対しTask3の共通処理（モック）が呼び出され、返却されたURLが`users.avatar_url`に設定される想定のロジックを検証する
- Task3側が形式・サイズ違反でエラーを返した場合、それが適切なAPIレスポンス（4xx）へ反映されることを検証する

### 結合テスト
- テスト用DB・Storageに対して実際にアイコン画像をアップロードし、`users.avatar_url`が更新されることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- アイコン画像をアップロードして変更できること
- アップロードした画像がEXIF位置情報除去・縮小画像生成など5.4の規則に従って処理されること
