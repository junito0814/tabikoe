# Task 6: 地図の吹き出しと戻り先名の戻る

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 1

## 実装内容

- `PinCallout`：「一覧」ボタンを削除し、吹き出しの本体（スポット名の行に「›」）をタップすると `/spots/[id]` へ。残すのは「投稿する」と「＋」
- `/map` の左上の戻る：`back` クエリの URL から戻り先の画面名を決める（`/search?pref=大阪府` → 「大阪府」、`/search?q=大阪駅` → 「大阪駅」、`/spots/[id]` → スポット名、`/posts/[id]` → スポット名、`/itineraries/[id]` → 「しおり」、無ければ「ホーム」）。スポット名はサーバー（`/map` の page.tsx）で引く。`map-navigation.ts` の `back.label` をこの規則に変える

## 成果物

- `src/components/map/PinCallout.tsx`
- `src/components/map/map-navigation.ts`・`src/app/map/page.tsx`

## テスト要件

### 単体テスト
- back の URL ごとの戻り先名（純粋関数）
- 吹き出しに「一覧」ボタンが無く、本体のリンク先が `/spots/[id]` であること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 左上の戻るに戻り先の画面名が出ること
