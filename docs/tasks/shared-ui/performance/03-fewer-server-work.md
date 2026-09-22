# Task 3: サーバーの仕事を減らす【保留】

> 出典: [performance.md](../../../user-stories/shared-ui/performance.md)
> インデックス: [performance](00-index.md)

Task 1・2 の効果を見てから着手する（2026-09-22）。

## 実装内容（予定）

- 1 画面 1 クエリ化: スポット別一覧・投稿詳細・ホームを Postgres の関数（RPC）にまとめる
- 写真の署名 URL を数分キャッシュする、またはサムネイル用バケットを公開にして署名を無くす
- 関所での一時停止・登録待ちの確認を署名付き Cookie に 5 分持たせて省く
