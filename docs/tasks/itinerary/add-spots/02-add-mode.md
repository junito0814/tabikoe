# Task 2: 追加モード

> 出典: [add-spots.md](../../../user-stories/itinerary/add-spots.md)
> インデックス: [add-spots](00-index.md)

## 依存

- Task 1
- post-timeline Task 4
- wishlist-v3 Task 1

## 実装内容

- しおり詳細の「＋ スポットを追加」→ `/search?pref=<最多の都道府県>&itinerary=<id>&day=<n>`（空なら `/?itinerary=<id>&day=<n>` で検索トップを追加モードで開き、決定後の一覧に引き継ぐ）
- 追加モード中の `SaveButton` はシートを出さず Task 1 を呼ぶ。入っているスポットはチェック表示、押すと外れる
- 「完了」で `/itineraries/[id]` に戻る

## 成果物

- `src/lib/itineraries/add-mode.ts`
- `src/components/posts/AddModeBanner.tsx`（post-timeline Task 4 と共用）
- `src/components/save/SaveButton.tsx`（追加モード分岐）

## テスト要件

### 単体テスト
- 行き先の自動決定（最多の都道府県、空なら検索トップ）
- 追加モード中の「＋」がシートを開かないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 追加モードの行き先がしおりのスポットの都道府県で自動的に埋まり、しおりが空なら検索トップが開くこと
- 既に入っているスポットの「＋」がチェック表示になり、押すと外れること
