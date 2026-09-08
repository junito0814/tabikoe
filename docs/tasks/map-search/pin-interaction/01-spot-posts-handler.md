# Task 1: スポット別投稿一覧取得 Route Handler

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)
> インデックス: [pin-interaction](00-index.md)

## 依存

- map-display [Task1: 「全体」タブ用ピン取得 Route Handler（/api/spots）](../map-display/01-spots-fetch-handler.md)

## 実装内容

- `GET /api/spots/{id}/posts`を実装し、指定スポットに紐づく公開設定「公開」の投稿一覧を返す
- 並び替えパラメータ（新着順・評価順・いいね順）を受け付ける。デフォルトは新着順
- 投稿が0件の場合は空配列を返す

## 成果物

- `app/api/spots/[id]/posts/route.ts`

## テスト要件

### 単体テスト
- 新着順・評価順・いいね順それぞれの並び替えロジックを検証する
- 非公開投稿が結果に含まれないことを検証する

### 結合テスト
- テスト用DBで、複数の並び替え条件に対して正しい順序の投稿一覧が返ることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿一覧を新着順／評価順／いいね順で並び替えられること
