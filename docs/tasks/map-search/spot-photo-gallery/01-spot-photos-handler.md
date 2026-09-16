# Task 1: スポット写真一覧取得 Route Handler

> 出典: [spot-photo-gallery.md](../../../user-stories/map-search/photo-view.md)
> インデックス: [spot-photo-gallery](00-index.md)

## 依存

- pin-interaction [Task1: スポット別投稿一覧取得 Route Handler](../pin-interaction/01-spot-posts-handler.md)

## 実装内容

- `GET /api/spots/{id}/photos`を実装し、指定スポットに紐づく公開設定「公開」の投稿の写真・動画（`post_photos`）を、投稿をまたいで横断的に取得する
- 並び順は投稿日時が新しい順（新着順）とする
- 1回につき40点を返すページングに対応する

## 成果物

- `app/api/spots/[id]/photos/route.ts`

## テスト要件

### 単体テスト
- 複数投稿にまたがる写真・動画が正しく統合され、新着順にソートされることを検証する
- 非公開投稿の写真・動画が結果に含まれないことを検証する

### 結合テスト
- テスト用DBで、公開・非公開投稿が混在するスポットに対してリクエストし、公開投稿分のみ返ることを確認する
- 40件を超えるデータでページングが正しく機能することを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 表示が新着順であり、1回40点のページングでスクロールに応じて追加読み込みされること
- 非公開設定の投稿の写真・動画は一覧に含まれないこと
