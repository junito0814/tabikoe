# Task 1: Supabase Auth OAuthプロバイダ設定

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

- Supabase AuthコンソールでGoogleプロバイダを有効化する
- GoogleでOAuthクライアントを作成し、クライアントID／シークレットをVercelの環境変数に設定する
- コールバックURL（Supabase発行）をGoogle側の許可リストに登録する
- 取得スコープを最小限（`openid`, `profile`, `email`）に絞る

## 成果物

- 環境変数一覧（`.env.example`更新）
- 設定手順のドキュメント化

## テスト要件

### 単体テスト
- 対象外（インフラ設定作業のため）。ただし、起動時に必須環境変数（GoogleのクライアントID／シークレット）が欠落している場合にアプリが明示的にエラー終了することを検証するテストを追加する

### 結合テスト
- ステージング環境で、Googleの認可画面まで遷移し、認可コードがSupabaseのコールバックURLに正しく返ってくることを手動確認する
- 取得スコープが `openid`, `profile`, `email` のみであることを認可画面の表示で確認する

### E2Eテスト
- なし（Task 9でまとめて検証）

## 関連する受入条件

- 取得スコープが最小限であること（実装上の留意点）
