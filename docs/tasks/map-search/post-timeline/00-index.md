# F-MP-04 投稿一覧（タイムライン・絞り込み・並び替え） — タスク分割

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)

v1 の `search-posts.ts`・`PostSearchScreen`・`PostCard`・`SpotPostListScreen` を作り替える。Task 1 が土台。Task 2・3・4 は Task 1 の後。

v1 の Epic: #105（v1 の投稿検索・絞り込み（/search））

| # | タスク | 依存 |
|---|---|---|
| 1 | [検索 API の行き先対応と付加情報の埋め込み](01-search-api-destination.md) | table-catalog-v3 Task 4、spot-selection-v3 Task 3 |
| 2 | [タイムライン UI（カード・並び替え・絞り込みシート）](02-timeline-ui.md) | Task 1、theme Task 3、media-layout-v3 Task 1 |
| 3 | [スクロール位置・条件の保持と「一覧に戻る」](03-scroll-and-back.md) | Task 2 |
| 4 | [スポット別一覧の見出しと追加モードバナー](04-spot-list-header-and-add-mode.md) | Task 2、add-spots Task 2 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | Task 1〜4 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
