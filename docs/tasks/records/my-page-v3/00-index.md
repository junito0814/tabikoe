# F-RC-01 マイページ（下書き・遷移メニュー） — タスク分割

> 出典: [my-page.md](../../../user-stories/records/my-page.md)

v1 の `MyPageScreen`・`MyPageMenu`・`my-page.ts` を土台にする。Task 1・2 は独立。

v1 の Epic: #179（v1 のマイページ）

| # | タスク | 依存 |
|---|---|---|
| 1 | [下書きの段と遷移メニューの変更](01-drafts-section-and-menu.md) | draft Task 3、theme Task 3 |
| 2 | [仮タイトルの付け直し促し](02-provisional-title-prompt.md) | trip-title-v3 Task 2 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
