# 主要な設計方針の一貫適用

> 出典: [requirement.md](../../requirement.md) 5.3

## ユーザーストーリー

開発者として、DBアクセス経路・RLS・レート制限・匿名化等の横断的な設計方針が全ストーリーで一貫して適用されていることを確認したい。なぜなら、方針が守られないと二重防御が崩れたり、機能ごとに実装方式がばらついて保守性が低下するから。

## 詳細

5.3に列挙された設計方針の実装状況は以下のとおり。新規タスクが必要な項目はない（テーブル定義は[table-catalog](table-catalog.md)、個別ロジックは各機能ストーリーで対応済み、または対応予定）。

| 項目 | 方針 | 実装状況 |
|---|---|---|
| ユーザー管理 | Supabase Authのauth.usersとpublic.usersを同一IDで1対1に対応させる | 実装済み（F-AC-01 Task2） |
| DBアクセスの経路 | 全てのDBアクセスはRoute Handlers内で行う。フロントエンドから直接呼び出さない | 全ストーリー共通の実装方針として適用済み |
| RLSの位置づけ | Route Handlers経由に一本化した上で、RLSも二重の防御線として有効化する | 各スキーマ定義タスクでRLSポリシーを設定済み（F-AC-01 Task2, F-PO-01 Task1, table-catalog各タスク）。**ただしRLSは行単位の制御しかできないため、下記2点を併用しないと二重防御が成立しない**（下の補足を参照） |
| 管理者判定 | users.is_adminをMiddlewareで参照し、管理画面配下のアクセス制御に用いる | 実装済み（F-AD-01 Task1のProxyで`/admin`配下を判定し、未ログイン・`is_admin=false`のいずれも404を返す）。この判定が意味を持つのは`is_admin`を本人が書き換えられない場合に限るため、F-AC-01 Task2の列単位GRANTとセットで成立する |
| 写真・動画の種別管理 | post_photos.media_typeで判定し、写真・動画それぞれの処理を行う | 実装済み（F-PO-01 Task4） |
| オーナー継承の実装 | album_members.joined_atと投稿数集計を用いて同一トランザクションで判定する | 実装済み（F-AC-05 Task2）。新オーナーの`role`更新に加え、退会者の`role`降格と`trips.user_id`の移譲まで同一トランザクションで行う |
| 通知の実装 | 各機能のRoute Handlers処理内で、イベント発生時にnotificationsへINSERTする | テーブル定義はtable-catalog Task3で完了。個別イベント（コメント・いいね・招待等）ごとのINSERT実装は、各イベントを持つ将来ストーリーで実施予定 |
| お知らせの実装 | system_announcementsへの1件のINSERTで全ユーザーに配信する | 未実装。管理者機能（F-AD-03）ストーリーで実装予定 |
| レート制限の実装 | rate_limitsテーブルを参照し、直近の時間枠の件数で上限判定する | 実装済み（F-AC-01 Task8）。テーブル定義はtable-catalog Task1で完了 |
| 旅行の識別 | tripsテーブルの主キーで識別する | 実装済み（F-PO-01 Task1） |
| アルバム権限 | album_membersテーブルで(trip_id, user_id, role, joined_at)を管理する | テーブル定義はtable-catalog Task2で完了。権限チェックロジック自体はアルバム機能（F-RC-02/03）ストーリーで実装予定 |
| 費用の保持 | posts.costは整数型（円）。未入力の場合はNULL | 実装済み（F-PO-01 Task1） |
| 退会時の扱い | usersはis_deletedフラグによる論理削除とし、表示名を匿名化する | 実装済み（F-AC-05 Task1） |

## 補足：RLSだけでは塞げない2つの経路

5.3の「RLSも二重の防御線として有効化する」を満たすには、RLSポリシーの設定に加えて以下が必要になる。いずれもPhase 0/1の実装監査で、実際に悪用可能な状態が見つかったもの。

### 1. 列単位のGRANT（RLSは行単位の制御しかできない）

RLSの`using`/`with check`は「どの行を操作できるか」しか制御しない。`users_update_own`のように「本人の行のみUPDATE可」としても、既定の列権限では全列が更新対象になるため、本人がPostgRESTへ直接 `PATCH /rest/v1/users?id=eq.<自分のid>` で `is_admin: true` を送れば管理者に昇格できてしまう（＝上表「管理者判定」のMiddlewareが無意味になる）。

→ 本人が更新してよい列だけを`grant update (列名) on ... to authenticated`で限定する。詳細はF-AC-01 [Task2](../../tasks/account/signup-login/02-users-table-migration.md)を参照。

### 2. SECURITY DEFINER関数のEXECUTE権限

Supabaseは`public`スキーマの関数をPostgRESTのRPC（`POST /rest/v1/rpc/<関数名>`）として公開し、PostgreSQLは新規関数に既定でPUBLICへEXECUTEを付与する。そのため、RLSを回避する目的で`security definer`にした関数は、絞らない限りブラウザに配布されるpublishable（anon）キーだけで誰でも実行できてしまう。

→ Route Handlers専用の関数は`revoke execute ... from public, anon, authenticated`の上で`service_role`にのみ付与する。該当するのは退会処理（F-AC-05 [Task1](../../tasks/account/account-deletion/01-deactivation-handler.md)）とレート制限判定（table-catalog [Task1](../../tasks/data-model/table-catalog/01-rate-limits-table.md)）。

## 受入条件

- [ ] 実装済みとした項目について、対応するタスクの結合テストが本方針（RLS二重防御・Route Handlers経由等）を検証していること
- [ ] 未実装の項目について、対応する将来ストーリーが明記されており、実装漏れが追跡可能であること
- [ ] 上記「補足」の2点について、本人が`is_admin`を更新できないこと・`anon`キーでSECURITY DEFINER関数を実行できないことが、各タスクの結合テストで検証されていること
