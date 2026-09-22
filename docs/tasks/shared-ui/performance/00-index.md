# 性能改善（performance）タスク

> カテゴリ: `shared-ui` / ストーリー: `performance`
> 出典: [performance.md](../../../user-stories/shared-ui/performance.md)、要件定義書 7.1

Task 1 を先に実装して実機で効果を確かめ、Task 2・3 はその結果を見てから着手する（2026-09-22 の決定）。

| # | タスク | 依存 | 状態 |
|---|---|---|---|
| 1 | [通信の回数を減らす](01-fewer-round-trips.md) | なし | 着手 |
| 2 | [骨組みを先に出す（ストリーミング）](02-streaming.md) | 1 | 保留 |
| 3 | [サーバーの仕事を減らす（1 画面 1 クエリ・署名 URL のキャッシュ）](03-fewer-server-work.md) | 1, 2 | 保留 |
