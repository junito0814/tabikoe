# Task 2: users テーブルのスキーマ定義・マイグレーション

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

- `public.users`テーブルを作成し、`auth.users`と同一IDで1対1対応させる
- カラム：`id`, `idp_provider`, `idp_subject`, `email`, `display_name`, `avatar_url`, `is_admin`, `is_deleted`, `consented_at`, `created_at`
- 本人のみ参照・更新可能なRLSポリシーを設定する（Route Handlers経由アクセスと二重防御）
- **RLSは行単位の制御しかできないため、列単位のGRANTで更新可能な列を限定する**。本人が更新してよいのは`display_name`・`avatar_url`のみとし、`is_admin`・`is_deleted`・`email`・`idp_provider`・`idp_subject`・`consented_at`・`created_at`は本人からの更新を禁止する（これらの更新はService Role Key経由のRoute Handlersでのみ行う）
  - RLSポリシーだけでは、認証済みユーザーがPostgRESTへ直接 `PATCH /rest/v1/users?id=eq.<自分のid>` で `is_admin: true` を送り、管理者に昇格できてしまう（5.3「管理者判定」のMiddlewareによるアクセス制御が回避される）

## 成果物

- マイグレーションファイル
- RLSポリシー定義
- 列単位のGRANT定義

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
- 列単位GRANTのテスト：
  - 本人のセッションで自分の行の`display_name`・`avatar_url`を更新できること
  - 本人のセッションで自分の行の`is_admin`を`true`に更新しようとすると拒否されること（権限昇格の防止）
  - 同様に`is_deleted`・`email`・`consented_at`が本人からは更新できないこと

### E2Eテスト
- なし（本タスク単体では画面を持たないため）

## 関連する受入条件

- なし（後続タスクの基盤となるスキーマ定義）
