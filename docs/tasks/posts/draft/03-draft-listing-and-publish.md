# Task 3: 下書きの取得と公開処理

> 出典: [draft.md](../../../user-stories/posts/draft.md)
> インデックス: [draft](00-index.md)

## 依存

- Task 1

## 実装内容

- `GET /api/users/me/drafts`（マイページ用。最新順、スポット名または「名前のない場所」・保存日時・サムネイル）と、`/api/users/me/map-spots`・`/api/spots` への本人の下書きピン（lat/lng）の追加
- 公開処理：`PATCH /api/posts/[id]` で `status` を `published` にするとき、必須項目の検証・スポット確定（spot-selection-v3 Task 3）・`published_at = now()`・バッジ判定・通知・しおりの自動チェック（itinerary-check Task 2）を実行する

## 成果物

- `src/app/api/users/me/drafts/route.ts`
- `src/lib/posts/publish-draft.ts`
- `src/lib/map/get-my-map-pins.ts`（draft 種別）

## テスト要件

### 単体テスト
- 公開時に `published_at` が設定され、投稿日時がその時点になること
- 必須項目が欠けた下書きの公開が検証エラーになること

### 結合テスト
- 公開した下書きが検索結果に現れ、下書き一覧から消えること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 下書きを「投稿する」と通常の投稿になり、投稿日時がその時点になること（受入条件53）
- 下書きがマイページの投稿数・投稿数バッジに数えられないこと
