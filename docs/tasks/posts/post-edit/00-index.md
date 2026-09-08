# F-PO-02 投稿編集 — タスク分割

> 出典: [post-edit.md](../../../user-stories/posts/post-edit.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存し、Task 3はTask 1・2に依存する。Task 4は全体の結合後に実施する。

本ストーリーは、post-creation（投稿作成）で実装済みのスキーマ・バリデーションルール・画像動画処理を前提とする。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿編集 Route Handler（PATCH /api/posts/{id}）](01-post-edit-handler.md) | post-creation Task3 |
| 2 | [写真・動画の個別編集（追加・削除）ロジック](02-media-edit-logic.md) | 1, post-creation Task4 |
| 3 | [投稿編集画面UI（SC-03 編集モード）](03-post-edit-ui.md) | 1, 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
