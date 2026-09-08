# Task 1: バッジ種別・獲得閾値の定義（共通カタログ）

> 出典: [status-badges.md](../../../user-stories/badges/status-badges.md)
> インデックス: [status-badges](00-index.md)

## 依存

- table-catalog [Task4: badges テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/04-badges-table.md)

## 実装内容

- 3種のバッジ（都道府県／投稿数／いいね数）と、`badges.badge_type`にどの文字列で保存するかの対応表を定義する共通モジュールを実装する（例：`prefecture:{都道府県名}`、`post_count:1`、`post_count:10`、`post_count:50`、`post_count:100`、`like_count:1`、`like_count:10`、`like_count:50`、`like_count:100`、`like_count:200`）
- 投稿数バッジ・いいね数バッジの閾値配列（`[1, 10, 50, 100]` / `[1, 10, 50, 100, 200]`）を定数として定義する
- Task 2・3・4がこのカタログを共通で参照する

## 成果物

- バッジカタログ定義モジュール（badge_type生成関数・閾値定数）

## テスト要件

### 単体テスト
- 都道府県名・投稿数閾値・いいね数閾値それぞれについて、正しい`badge_type`文字列が生成されることを検証する
- 閾値配列に含まれない中間の数値（例：投稿数5件）に対しては該当バッジが存在しないことを検証する

### 結合テスト
- 対象外（Task 2・3の結合テストでカバーする）

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- なし（本タスクは後続タスクの前提となる共通定義のみ）
