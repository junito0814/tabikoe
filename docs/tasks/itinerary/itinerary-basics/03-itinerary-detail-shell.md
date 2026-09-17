# Task 3: しおり詳細画面の骨格（SC-23）

> 出典: [itinerary-basics.md](../../../user-stories/itinerary/itinerary-basics.md)
> インデックス: [itinerary-basics](00-index.md)

## 依存

- Task 1
- theme Task 3

## 実装内容

- `/itineraries/[id]`：ヘッダー（戻る・旅行タイトル・「地図で見る」）、期間行（「期間を変更」）、「アルバムを見る」（同じ旅行に投稿があるとき）、「⋯」メニュー（招待・メンバー・しおりを削除。オーナーのみ）、スポット一覧の枠、「＋ スポットを追加」、右下「しおりを削除」（確認ダイアログにアルバムは残る旨）
- Day タブ・行の中身は itinerary-days／arrival-time／itinerary-check で埋める

## 成果物

- `src/app/itineraries/[id]/page.tsx`
- `src/components/itineraries/ItineraryDetailScreen.tsx`

## テスト要件

### 単体テスト
- オーナーとメンバーでメニューが変わること
- 削除ダイアログの文言

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 保存先シートの「＋ 新しいしおりを作る」およびしおり一覧の「＋ 新規」で、旅行タイトルと期間を指定してしおりを作れ、同名のアルバムと同じ旅行 ID で紐づくこと（受入条件57）
