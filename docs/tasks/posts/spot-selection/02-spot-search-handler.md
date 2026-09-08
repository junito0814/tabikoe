# Task 2: スポット候補検索 Route Handler（Google Places API + 手動登録スポット統合）

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)
> インデックス: [spot-selection](00-index.md)

## 依存

- post-creation [投稿関連テーブルのスキーマ定義・マイグレーション](../post-creation/01-post-schema-migration.md)

## 実装内容

- `GET /api/spots/search?query=...`を実装する
- Google Places APIの検索結果と、Supabase上の手動登録スポットを統合する
- 投稿数が多い順に並べ、Google由来・手動登録あわせて最大5件を返す

## 成果物

- `app/api/spots/search/route.ts`

## テスト要件

### 単体テスト
- Places API結果（モック）とDB検索結果（モック）を統合し、投稿数降順でソートするロジックを検証する
- 統合後の件数が最大5件に制限されることを検証する

### 結合テスト
- テスト用のPlaces APIレスポンス（モックサーバー、またはテスト用APIキー）とテスト用DBを用いて、実際に統合結果が返ることを確認する
- Places APIがエラーを返す場合、6.2節に定めるエラー扱いとしてAPIがエラーレスポンスを返し、フロントエンド側で手動登録（SC-19）へ誘導できる状態になることを確認する

### E2Eテスト
- なし（[Task 7: 受入テスト（E2E）](07-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- Google Places候補からのスポット選択ができること
