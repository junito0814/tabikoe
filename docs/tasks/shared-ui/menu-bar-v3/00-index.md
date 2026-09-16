# 共通メニューバー（4 項目） — タスク分割

> 出典: [menu-bar.md](../../../user-stories/shared-ui/menu-bar.md)

v1 の `AppMenuBar`／`menu-bar-config.ts` を差し替える。Task 1 → 2 の順。

v1 の Epic: #210（v1 の 4 項目：全体マップ・新規投稿・通知・マイページ）

| # | タスク | 依存 |
|---|---|---|
| 1 | [メニュー項目の差し替えと表示条件](01-menu-config-and-visibility.md) | theme Task 1 |
| 2 | [パソコン幅の左サイドバー](02-desktop-sidebar.md) | Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
