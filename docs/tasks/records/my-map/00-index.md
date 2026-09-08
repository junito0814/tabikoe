# F-RC-06 マイマップ — タスク分割

> 出典: [my-map.md](../../../user-stories/records/my-map.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存。Task 3はTask 2に依存。Task 4は全体の結合後に実施する。

本ストーリーは、`map-search`カテゴリの地図表示（F-MP-01）の基本地図コンポーネント、および[pin-display-rules](../../shared-ui/pin-display-rules/00-index.md)のピン描画インターフェースを再利用する前提とする（3.6.5「実装方針」準拠）。

| # | タスク | 依存 |
|---|---|---|
| 1 | [マイマップ用ピンデータ取得 Route Handler](01-my-map-pin-data-handler.md) | post-creation Task1, wishlist Task1 |
| 2 | [地図コンポーネントの再利用・ピン種別統合](02-map-component-reuse-integration.md) | 1, pin-display-rules Task2 |
| 3 | [ピン操作時の遷移制御](03-pin-tap-navigation.md) | 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
