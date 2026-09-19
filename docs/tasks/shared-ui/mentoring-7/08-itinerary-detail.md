# Task 8: しおり詳細の操作の簡略化（ALL・年つき期間・タップ編集・ドラッグ・地図）

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 1、Task 4

## 実装内容

- `DayTabs`：左端に ALL（全スポット。Day の順 → 日付なしの順）を置き、「未定」タブを廃止する。日付なしのスポットは ALL にだけ出る。`ItineraryDetailScreen` の初期タブは ALL
- 期間の表示を「2026/9/20（金）〜 2026/9/22（日）」（年つき）にし、表示自体をタップすると `PeriodDialog`（カレンダー）が開く。「期間を変更」「名前を変更」ボタンを削除し、タイトルの表示をタップ（鉛筆マーク）で `RenameTripDialog` を開く
- 行から値段（★の横の金額）と見出しの「予算目安」を削除する（`get-itinerary.ts` の costAverage・budgetEstimate を返さない）
- 上下ボタンを廃止し、時刻の無い行をドラッグ（取っ手 ≡。`@dnd-kit/sortable` またはポインターイベント）で並べ替える。パソコンも同じ
- 「地図で見る」を押すと別画面へ飛ばず、上 1/3 に地図（`ItineraryMapOverlay` の番号ピン。Task 4 のレイアウト）を出し、下 2/3 に一覧を残す。もう一度押すと閉じる。地図のタップで全画面（`/map?itinerary=`）

## 成果物

- `src/components/itineraries/DayTabs.tsx`・`DayMoveDropdown.tsx`・`ItineraryDetailScreen.tsx`・`ItinerarySpotRow.tsx`・`PeriodDialog.tsx`
- `src/lib/itineraries/get-itinerary.ts`・`day-utils.ts`（`formatDayLabel` に年）
- `src/components/map/ItineraryMapOverlay.tsx`

## テスト要件

### 単体テスト
- タブが ALL＋日数分になること。日付なしのスポットが ALL にだけ出ること
- 期間ラベルに年が含まれること
- ドラッグで sort_order が入れ替わること（時刻のある行は動かせないこと）
- 値段が描画されないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおり詳細で ALL タブが左端にあり、期間に年が出て、期間・タイトルの表示をタップして編集でき、値段が表示されず、時刻の無い行をドラッグで並べ替えられること（受入条件58・62）
