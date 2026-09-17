# F-PO-01 投稿作成（上 1/3 地図＋下 2/3 フォーム） — タスク分割

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)

v1 の `PostForm`・`/api/posts`・写真アップロードを土台に、API の検証・フォームの配置・画面レイアウト・動画を変える。Task 1 が土台。Task 2・3・4 は Task 1 の後に並行できる。

v1 の Epic: #126（v1 の全画面フォーム）

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿 API の検証変更（カテゴリ 7・日付必須・位置・状態）](01-post-api-validation.md) | table-catalog-v3 Task 1 |
| 2 | [フォームの配置変更（2 列・横並び・ドロップダウン）](02-form-layout-compaction.md) | theme Task 3、media-layout-v3 Task 2 |
| 3 | [SC-03 の 1：2 レイアウトとシート挙動](03-split-screen-layout.md) | Task 2、spot-selection-v3 Task 1 |
| 4 | [動画（MP4／MOV）の受付と変換](04-video-mov-support.md) | Task 1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | Task 1〜4 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
