# F-PO-04 下書き — タスク分割

> 出典: [draft.md](../../../user-stories/posts/draft.md)

posts の `status = 'draft'` を使う。Task 1 が土台。Task 2・3 は Task 1 の後に並行できる。

| # | タスク | 依存 |
|---|---|---|
| 1 | [下書きの保存・更新・削除 API](01-draft-save-api.md) | table-catalog-v3 Task 1、table-catalog-v3 Task 5、post-creation-v3 Task 1 |
| 2 | [「下書きに保存」と自動保存の UI](02-draft-ui-autosave.md) | Task 1、post-creation-v3 Task 3 |
| 3 | [下書きの取得と公開処理](03-draft-listing-and-publish.md) | Task 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
