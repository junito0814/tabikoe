# Task 2: 投稿数・都道府県バッジの判定ロジック（投稿作成時）

> 出典: [status-badges.md](../../../user-stories/badges/status-badges.md)
> インデックス: [status-badges](00-index.md)

## 依存

- [Task 1: バッジ種別・獲得閾値の定義（共通カタログ）](01-badge-catalog-definition.md)
- posts/post-creation [Task3: 投稿作成 Route Handler（バリデーション・保存）](../../posts/post-creation/03-post-creation-handler.md)
- posts/spot-selection [Task6: 逆ジオコーディングによる都道府県判定の統合](../../posts/spot-selection/06-prefecture-reverse-geocoding.md)

## 実装内容

- 投稿作成 Route Handler（posts/post-creation Task3）の保存処理完了後に呼び出される共通関数として実装する
- 投稿数バッジ：当該ユーザーの累計投稿数（非公開投稿を含む）を集計し、Task1の閾値配列のいずれかに新たに到達した場合、`badges`テーブルへ該当`badge_type`（例：`post_count:10`）をINSERTする（`(user_id, badge_type)`の一意制約により重複INSERTは発生しない前提とし、念のためINSERT時にconflictを無視するupsertとする）
- 都道府県バッジ：投稿に紐づくスポットの`spots.prefecture`を参照し、当該都道府県での初投稿であれば`badges`テーブルへ`prefecture:{都道府県名}`をINSERTする
- 呼び出し元（投稿作成 Route Handler）のレスポンスに、新たに獲得したバッジの一覧を含める（[Task 5: トースト表示](05-badge-toast-notification.md)で利用）

## 成果物

- 投稿数・都道府県バッジの判定・付与関数
- 投稿作成 Route Handlerからの呼び出し組み込み

## テスト要件

### 単体テスト
- 投稿数が9→10件になるケースで`post_count:10`が付与されることを検証する
- 投稿数が10→11件になるケースで新たなバッジが付与されないことを検証する
- 同一都道府県への2件目の投稿では、都道府県バッジが重複付与されないことを検証する
- `spots.prefecture`が未設定（逆ジオコーディング未完了）の投稿では、都道府県バッジの判定をスキップすることを検証する

### 結合テスト
- テスト用DBで、投稿数バッジの各閾値（1/10/50/100）到達時に`badges`テーブルへ正しくレコードが作成されることを確認する
- 異なる都道府県のスポットへの投稿で、それぞれ独立した都道府県バッジが付与されることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 都道府県バッジが、スポット登録時のサーバー側逆ジオコーディング結果に基づいて正しく判定されること
- 投稿数バッジ（1／10／50／100件）が、累計投稿数の到達時点で正しく付与されること
