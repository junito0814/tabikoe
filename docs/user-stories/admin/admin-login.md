# F-AD-01 管理者ログイン

> 出典: [requirement.md](../../requirement.md) 3.10.1

## ユーザーストーリー

管理者として、一般ユーザーと同じGoogleログインを使いながら、自分がis_adminフラグを持つ場合のみ管理画面にアクセスしたい。なぜなら、新しい認証方式を増やすことなく、安全に管理機能を一般ユーザーから分離したいから。

## 詳細

- 認証方式は一般ユーザーと同じGoogle認証（F-AC-01）を再利用する。管理者専用の新しい認証方式は追加しない。
- `is_admin`フラグの付与は画面上からの操作を設けない。Supabaseの管理コンソールから開発者が直接該当ユーザーのレコードに設定する（具体的な運用手順は9章 未決定事項No.4）。
- `/admin`配下のルートへのアクセスは、Route Handlers（Middleware）で`is_admin`を検証する。`is_admin`がfalse、または未ログインの場合は404を返す（管理画面の存在自体を一般ユーザーに露出させない）。
- 管理者としてログインに成功した場合、管理者ダッシュボード（SC-16、[admin-dashboard.md](admin-dashboard.md)）に着地する。
- `users.is_admin`カラムは、F-AC-01のusersテーブル定義（[users-table-migration](../../tasks/account/signup-login/02-users-table-migration.md)）で既に定義済みであり、本ストーリーで新たにマイグレーションは行わない。

## 受入条件

- [ ] `is_admin`がfalse、または未ログインの状態で`/admin`配下のURLへアクセスすると404が返ること
- [ ] `is_admin`がtrueのユーザーがログインすると、管理者ダッシュボード（SC-16）に遷移すること
- [ ] 管理者ログインが一般ユーザーと同じGoogle認証フローで完了すること（管理者専用の認証方式が存在しないこと）
