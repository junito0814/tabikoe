# Task 3: 投稿時のスポット確定（新規登録・重複判定・都道府県）

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)
> インデックス: [spot-selection-v3](00-index.md)

## 依存

- Task 2
- post-creation-v3 Task 1

## 実装内容

- `POST /api/posts` で `spot_id` が無く `lat`／`lng` がある場合、サーバー側で再度 50m 判定を行い、既存があればそれに寄せ、無ければ `spots` に `source = 'manual'`・名前（未入力なら「名前のない場所」）で登録して逆ジオコーディングを実行する
- 「タビコエだけの場所」の判定（`spots.source = 'manual'`）を投稿一覧・詳細の取得に含める
- 下書き（`status = 'draft'`）ではスポットを作らない

## 成果物

- `src/lib/spots/finalize-spot.ts`
- `src/app/api/posts/route.ts`（呼び出し）
- `src/lib/posts/post-cards.ts`（`isManualSpot`）

## テスト要件

### 単体テスト
- 既存 50m 以内 → 既存 ID、無し → 新規作成、下書き → 作成しない、の 3 分岐

### 結合テスト
- 新規スポットが manual で作られ prefecture が入ること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「新しい場所」のまま投稿すると、ピンの位置でスポットが新規登録され「タビコエだけの場所」ラベルが表示されること（受入条件54）
- 半径50m以内に既存スポットがある位置で「新しい場所」として投稿しても、新規登録されず既存スポットに紐づくこと（受入条件37）
