# F-PO-02 投稿編集（位置の変更） — タスク分割

> 出典: [post-edit.md](../../../user-stories/posts/post-edit.md)

編集画面も SC-03 と同じ `PostComposeScreen` を使う。Task 1 のみ。

v1 の Epic: #139（v1 の投稿編集）

| # | タスク | 依存 |
|---|---|---|
| 1 | [編集画面での位置・スポットの変更](01-edit-location.md) | post-creation-v3 Task 3、spot-selection-v3 Task 4 |
| 2 | [受入テスト（E2E）](02-acceptance-e2e.md) | Task 1〜1 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
