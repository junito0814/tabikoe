# Task 2: 移動手段の追加（電車・バス）と所要時間の反映

> 出典: [travel-time.md](../../../user-stories/map-search/travel-time.md)
> インデックス: [travel-time](00-index.md)
> 要件定義書 3.4.6・4.5.7

## 依存

- [Task 1: Routes API の呼び出しとキャッシュ](01-routes-api-client.md)

## 実装内容

- `TRAVEL_MODES` に `train`・`bus` を追加（徒歩／自転車／車／電車／バス）。半径は 1km／3km／10km／15km／5km
- `GET /api/posts/nearby?mode=` が自転車以外のとき Routes API を使い、取れなければ目安に切り替える。応答には分数だけを載せ、実測か目安かは載せない（画面で区別しないため）
- `NearbyVoices` の「移動手段 ▾」に電車・バスを足す。表示文言は 4.5.7 に合わせる
- 地図の状態の復元（`lib/map/map-state.ts`）が新しい移動手段も覚えること
- 既存の URL（`?travel=walk|bicycle|car`）はそのまま。知らない値は徒歩に倒す

## 成果物

- `src/lib/geo/travel-time.ts`、`src/lib/posts/nearby-posts.ts`、`src/app/api/posts/nearby/route.ts`、`src/components/map/NearbyVoices.tsx`

## テスト要件

### 単体テスト
- 移動手段 5 つの半径と既定（徒歩）、知らない値の扱い
- 徒歩・車のとき Routes API の値が使われ、失敗時は目安になること（差し替え口で検証）。自転車では呼ばないこと
- 「移動手段 ▾」に 5 つ出て、選ぶと取り直すこと
- 地図の状態の復元に電車・バスが含まれること

## 関連する受入条件

- 要件定義書 8 章 79
