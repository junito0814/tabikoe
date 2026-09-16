# Task 2: しおり一覧画面（SC-22）

> 出典: [itinerary-basics.md](../../../user-stories/itinerary/itinerary-basics.md)
> インデックス: [itinerary-basics](00-index.md)

## 依存

- Task 1
- menu-bar-v3 Task 1
- theme Task 3

## 実装内容

- `/itineraries`：自分のしおりを期間が近い順（未設定は更新日時順）に、旅行タイトル・期間（未設定なら「期間未設定」）・スポット数・済み件数で一覧する。写真は置かない。期間を過ぎたものは末尾に薄く表示し「アルバムを見る」
- 「＋ 新規」でタイトルと期間（任意）を入力して作成。0 件時の案内文

## 成果物

- `src/app/itineraries/page.tsx`
- `src/components/itineraries/ItineraryListScreen.tsx`
- `src/components/itineraries/CreateItineraryDialog.tsx`
- `src/lib/itineraries/sort-itineraries.ts`

## テスト要件

### 単体テスト
- 並び順（期間が近い順→未設定→過ぎたもの）
- 期間を過ぎた行に「アルバムを見る」が出ること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおり一覧がメニューバーから開け、期間が近い順に並び、期間を過ぎたしおりが末尾に薄く表示されて「アルバムを見る」が出ること（受入条件65）
