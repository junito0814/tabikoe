# メンタリング 7 回目の反映（v3.1） — タスク分割

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)

Phase 10〜14 で作った v3.0 の画面を、2026-09-18 のメンタリングの指摘に沿って直す。Task 1（用語）を最初に済ませ、Task 2（日常）と Task 3（スポット単位）が土台。Task 4〜9 はその後。

| # | タスク | 依存 |
|---|---|---|
| 1 | [用語の統一と細かな文言・表示の変更](01-terminology.md) | なし（他のタスクより先に行う） |
| 2 | [「日常」アルバム（仮タイトルの廃止）](02-daily-album.md) | Task 1 |
| 3 | [検索結果のスポット単位化（スポットカード・並び替え）](03-spot-cards.md) | Task 1 |
| 4 | [スポット別一覧・投稿詳細の上 1/3 地図（1：2 のシート）](04-map-on-top.md) | Task 3 |
| 5 | [写真タブの上限と写真からの遷移](05-photo-tab.md) | Task 3 |
| 6 | [地図の吹き出しと戻り先名の戻る](06-map-callout-and-back.md) | Task 1 |
| 7 | [地図の状態の復元](07-map-state-restore.md) | Task 6 |
| 8 | [しおり詳細の操作の簡略化（ALL・年つき期間・タップ編集・ドラッグ・地図）](08-itinerary-detail.md) | Task 1、Task 4 |
| 9 | [しおり一覧の「済」と行きたいの入口、アルバムの名前変更の廃止](09-itinerary-list-and-album.md) | Task 2 |
| 10 | [受入テスト（E2E）](10-acceptance-e2e.md) | Task 1〜9 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
