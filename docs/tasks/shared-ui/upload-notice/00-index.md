# 投稿時の注意喚起 — タスク分割

> 出典: [upload-notice.md](../../../user-stories/shared-ui/upload-notice.md)

各タスクの詳細・テスト要件は個別ファイルを参照。本ストーリーは、投稿作成（post-creation）・投稿編集（post-edit）で実装済みのアップロードUIに注意文を追加するのみの小規模なストーリーのため2タスクに分割する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿作成・編集画面への注意文表示](01-notice-display.md) | post-creation Task2, post-edit Task3 |
| 2 | [受入テスト（E2E）](02-acceptance-e2e.md) | 1 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
