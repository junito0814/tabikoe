# F-SF-02 ブロック — タスク分割

> 出典: [blocking.md](../../../user-stories/safety/blocking.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4は全体の結合後に実施する。`blocks`テーブル自体はdata-model/table-catalogで定義済みのため、本ストーリーでは再定義しない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [ブロック／解除 Route Handler](01-block-unblock-handler.md) | なし |
| 2 | [ブロック対象コンテンツ除外の共通フィルタ実装](02-blocked-content-filter-helper.md) | 1 |
| 3 | [ブロック操作・一覧UI（プロフィール編集画面への追加）](03-block-management-ui.md) | 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。

## 注記

- `blocks`テーブルは table-catalog [Task5: 対話系テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)で定義済み（`blocker_id`, `blocked_id`）
- Task 2の共通フィルタは、地図・検索（map-search）・閲覧・交流（browsing）・記録・振り返り（records）等、ブロック関係を考慮すべき各機能ストーリーの実装時に組み込まれる想定のインターフェースであり、本タスクでは提供のみを対象とする（各消費側での組み込みタスクは、それぞれのストーリー側で扱う）
- 退会時のブロック情報削除は account/account-deletion の範囲で扱い、本ストーリーでは新規タスクを設けない
