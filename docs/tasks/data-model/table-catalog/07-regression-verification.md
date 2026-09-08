# Task 7: 既存タスクの結合検証（回帰確認）

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

- [Task 1: rate_limits テーブルのスキーマ定義・マイグレーション](01-rate-limits-table.md)
- [Task 2: album_members テーブルのスキーマ定義・マイグレーション](02-album-members-table.md)
- [Task 3: notifications テーブルのスキーマ定義・マイグレーション](03-notifications-table.md)
- [Task 4: badges テーブルのスキーマ定義・マイグレーション](04-badges-table.md)
- [Task 5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](05-interaction-tables.md)
- [Task 6: operation_logs テーブルのスキーマ定義・マイグレーション](06-operation-logs-table.md)

## 実装内容

- Task1〜6で新規定義したテーブルに対し、これらのテーブルに依存していた既存タスク（F-AC-01 Task8, F-PO-01 Task5, F-AC-05 Task1・Task2, F-PO-03 Task3, menu-bar Task2）の結合テストを一括で再実行し、スキーマ不整合による失敗がないことを確認する
- 失敗が見つかった場合は、当該テーブルのマイグレーション（Task1〜6）を修正する

## 成果物

- 回帰検証結果の記録

## テスト要件

### 単体テスト
- 対象外

### 結合テスト
- 以下の既存タスクの結合テストを、実際のマイグレーション適用後のDBに対してすべて再実行し、成功することを確認する
  - F-AC-01 Task8（ログイン試行のレート制限）
  - F-PO-01 Task5（投稿作成レート制限）
  - F-AC-05 Task1（退会実行 Route Handler）
  - F-AC-05 Task2（アルバムオーナー継承ロジック）
  - F-PO-03 Task3（バッジ保持ロジックの回帰テスト）
  - menu-bar Task2（通知未読件数バッジの表示）

### E2Eテスト
- なし（対象のE2Eは各ストーリーの受入テストタスクで実施済み・実施予定）

## 関連する受入条件

- 新規定義したテーブルに対し、既存タスク（F-AC-05, F-PO-03, menu-bar）の結合テストが実際のスキーマに対して実行でき、成功すること
