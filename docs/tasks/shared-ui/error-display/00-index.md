# エラー表示 — タスク分割

> 出典: [error-display.md](../../../user-stories/shared-ui/error-display.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存、Task 3は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [共通エラー表示コンポーネントの実装](01-error-notice-component.md) | なし |
| 2 | [各外部サービス障害時のエラーメッセージ組み込み](02-service-specific-error-integration.md) | 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
