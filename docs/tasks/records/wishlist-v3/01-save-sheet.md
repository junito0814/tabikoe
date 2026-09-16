# Task 1: 保存先シート（行きたい＋しおり＋Day）

> 出典: [wishlist.md](../../../user-stories/records/wishlist.md)
> インデックス: [wishlist-v3](00-index.md)

## 依存

- itinerary-basics Task 1
- add-spots Task 1
- theme Task 3

## 実装内容

- `SaveSheet`（下からのシート）：上段「行きたいスポット」（件数、チェックで `/api/wishlist` を呼ぶ）、下段に自分のしおり一覧（`GET /api/itineraries?spot=<id>` で入っているものはチェック済み）と「＋ 新しいしおりを作る」。しおりのチェックで `/api/itineraries/[id]/spots` を呼び、期間があれば Day 選択（既定は未定）を展開
- 閉じるとトースト「〈しおり名〉に保存しました [しおりを見る]」
- `WishlistButton` を `SaveButton`（＋アイコン。保存済みならチェック表示）に置き換え、投稿カード・詳細・スポット別見出し・ピン吹き出しに置く。追加モード中はシートを出さず直接追加

## 成果物

- `src/components/save/SaveSheet.tsx`
- `src/components/save/SaveButton.tsx`
- `src/components/wishlist/WishlistButton.tsx`（置き換え）

## テスト要件

### 単体テスト
- チェックの付け外しで対応 API が呼ばれること
- 期間ありのしおりで Day 選択が展開し、既定が未定であること
- 追加モード中はシートを開かず追加 API を呼ぶこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 同じスポットを行きたいとしおりの両方に入れられること
