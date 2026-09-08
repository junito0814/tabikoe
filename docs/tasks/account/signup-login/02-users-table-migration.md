# Task 2: users テーブルのスキーマ定義・マイグレーション

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

- `public.users`テーブルを作成し、`auth.users`と同一IDで1対1対応させる
- カラム：`id`, `idp_provider`, `idp_subject`, `email`, `display_name`, `avatar_url`, `is_admin`, `is_deleted`, `consented_at`, `created_at`
- 本人のみ参照・更新可能なRLSポリシーを設定する（Route Handlers経由アクセスと二重防御）

## 成果物

- マイグレーションファイル
- RLSポリシー定義

## テスト要件

### 単体テスト
- 対象外（DDL・ポリシー定義そのものにはユニットテストが適用しにくいため、下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境（`supabase db reset`等）でマイグレーションが冪等に適用できることを確認する
- 必須カラムのNOT NULL制約・型・デフォルト値がスキーマ通りであることを確認する
- RLSポリシーのテスト：
  - 本人のセッションで自分の行をSELECT／UPDATEできること
  - 他ユーザーのセッションで他人の行をSELECT／UPDATEできないこと
  - Service Role Key経由（Route Handlers想定）ではRLSを回避して全行にアクセスできること

### E2Eテスト
- なし（本タスク単体では画面を持たないため）

## 関連する受入条件

- なし（後続タスクの基盤となるスキーマ定義）
