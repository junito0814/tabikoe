# F-IT-04 スポットの追加と追加モード — タスク分割

> 出典: [add-spots.md](../../../user-stories/itinerary/add-spots.md)

> **2026-11-07 に入口が変わった**（ワイヤーフレーム決定事項 102）。「＋ スポットを追加」は追加モードではなくシートを開き、タビコエに無い場所も入れられるようになる。追加モードは残り、シートの「投稿から探す」から入る。帯から Day を外し、Day はカードの札で選ぶ。**この変更のタスクは [add-spots-v4](../add-spots-v4/00-index.md)**。ここにある 3 本は 2026-09-16 時点の記録として残す（実装済み）。

Task 1 → 2。

| # | タスク | 依存 |
|---|---|---|
| 1 | [スポット追加・削除 API](01-add-remove-spot-api.md) | itinerary-basics Task 1 |
| 2 | [追加モード](02-add-mode.md) | Task 1、post-timeline Task 4、wishlist-v3 Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
