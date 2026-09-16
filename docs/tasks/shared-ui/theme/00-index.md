# 配色とダークモード — タスク分割

> 出典: [theme.md](../../../user-stories/shared-ui/theme.md)

色を CSS 変数に集約してから置き換える。Task 1 → 2 → 3 の順。他の v3.0 ストーリーの画面はこの変数を使う前提なので、最初に着手する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [CSS 変数への色集約（ライト）](01-css-variables-light.md) | なし |
| 2 | [ダークモードの変数と Google マップのダークスタイル](02-dark-mode-variables-and-map-style.md) | Task 1 |
| 3 | [直書き色の置き換えとコントラスト確認](03-replace-hardcoded-colors.md) | Task 1、Task 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
