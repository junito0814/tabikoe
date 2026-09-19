# Task 11: シートのドラッグ（1：2 ⇄ 全画面、2 段階スナップ）の共通部品

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 4.5.6（2026-09-19 に追加。決定事項 43）

## 依存

- Task 4（`MapSheetLayout` の土台）、Task 8（しおり詳細の地図表示）

## 実装内容

- `MapSheetLayout` に指での操作を入れる：シートの取っ手（と内容の先頭）を上にドラッグすると全画面（地図は隠れる）、全画面でシート内を先頭までスクロールした状態からさらに下にドラッグすると 1：2 に戻る。1：2 より下には縮めない
- 途中では止めず、指を離した位置が近い方（1：2／全画面）に吸い付く。速いフリック（閾値 0.5px/ms 程度）は方向に従う。`transform: translateY` でアニメーション（`prefers-reduced-motion` では即時）
- 取っ手は `button`（aria-label「シートを広げる／戻す」、`aria-expanded`）にし、Enter／Space で切り替える
- 1：2 のときだけ上の地図をタップできる（全画面では地図を描画しない、または `inert`）
- 対象 4 画面（`PostComposeScreen`・`SpotPostListScreen`・`PostDetailScreen`・`ItineraryDetailScreen` の地図表示）を同じ部品に乗せる。パソコン幅（md 以上）では左右分割のまま無効
- Pointer Events で実装し、`touch-action: pan-y` でスクロールと両立させる（`use-long-press.ts` と同じ流儀）

## 成果物

- `src/components/layout/MapSheetLayout.tsx`・`use-sheet-drag.ts`（新設）
- `src/components/posts/PostComposeScreen.tsx`・`SpotPostListScreen.tsx`・`PostDetailScreen.tsx`
- `src/components/itineraries/ItineraryDetailScreen.tsx`

## テスト要件

### 単体テスト
- ドラッグ量が半分未満で離すと元の状態に戻り、半分以上で反対の状態に吸い付くこと（pointer イベントのシミュレーション）
- 全画面でシートが先頭にないときは下ドラッグで縮まないこと
- 取っ手の Enter で `aria-expanded` が切り替わること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)に受入条件 76 を追加して検証する）

## 関連する受入条件

- 受入条件76（v3.2）：SC-03・SC-04 スポット別・SC-05・SC-23 の地図表示で、下のシートを上にスライドすると全画面になり、先頭で下にスライドすると 1：2 に戻り、途中で離しても近い方に吸い付くこと
