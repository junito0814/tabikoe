# Task 7: 探すモードの移動手段（徒歩／自転車／車）

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- v3.1 Task 7（#428。地図の状態の復元に含めるため）

## 実装内容

- `lib/geo/travel-time.ts`（新設）：`TravelMode = walk | bicycle | car`、半径（1,000／3,000／10,000 m）と速度（80／250／500 m/分）、`travelMinutes(distance, mode)`（切り上げ）と表示文言（「徒歩 6 分」「自転車で約 8 分」「車で約 12 分」）。`walk-minutes.ts` はこれに寄せる
- `GET /api/posts/nearby`：`radius` の代わりに `mode` を受け取り（互換のため radius も残す）、その半径で近い順 20 件。応答に mode と分数を含める
- `NearbyVoices`：「徒歩圏 ▾」を「移動手段 ▾」（徒歩／自転車／車。既定 徒歩）に。切り替えると取り直し、カードの分数表示が変わる。URL は `/map?mode=explore&travel=car`
- `map-navigation.ts`・地図の状態の復元（sessionStorage）に `travel` を含める
- 投稿一覧の「徒歩 N 分」（検索結果）は徒歩のまま変えない

## 成果物

- `src/lib/geo/travel-time.ts`・`walk-minutes.ts`
- `src/app/api/posts/nearby/route.ts`・`src/lib/posts/nearby-posts.ts`
- `src/components/map/NearbyVoices.tsx`・`MapScreen.tsx`・`map-navigation.ts`

## テスト要件

### 単体テスト
- 2,000m は 徒歩 25 分／自転車で約 8 分／車で約 4 分 になること
- 移動手段を車にすると半径 10km で取り直され、文言が「車で約 N 分」になること
- 地図に戻ったとき travel が復元されること

### 結合テスト
- `/api/posts/nearby?mode=bicycle` が 3km 以内だけを返すこと

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件75
