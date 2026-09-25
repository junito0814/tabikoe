# Task 1: Routes API の呼び出しとキャッシュ

> 出典: [travel-time.md](../../../user-stories/map-search/travel-time.md)
> インデックス: [travel-time](00-index.md)
> 要件定義書 3.4.6・6.7

## 依存

- なし（Places・Geocoding と同じく Route Handlers からサーバー用キーで呼ぶ）

## 実装内容

- `src/lib/google/routes.ts`: `computeRouteMatrix`（出発地 1 × 目的地 最大 20）を呼び、目的地ごとの所要時間（秒）を返す。移動手段は `DRIVE`（渋滞考慮）、`TRANSIT`（鉄道／バスを出し分け、出発時刻は「今」）
- APIキーは `GOOGLE_ROUTES_API_KEY`（Places・Geocoding とは別。Routes API だけを有効にする）
- 失敗・上限・経路なしは例外にせず「取れなかった」を返し、呼び出し側が目安に切り替えられるようにする
- キャッシュ: 現在地を約 100m 単位に丸めたキー＋移動手段＋目的地の組で 10 分。サーバーのメモリに持つ（プロセスをまたぐ保証は不要）
- 実装前に確認: `computeRouteMatrix` の `TRANSIT` に件数や機能の制限がある場合は、電車・バスだけ 1 件ずつの `computeRoutes` に切り替える（要件定義書 6.7 の「確認事項」）

## 成果物

- `src/lib/google/routes.ts`、`src/lib/geo/travel-time.ts` の改訂（目安の速度と表示文言）

## テスト要件

### 単体テスト
- 応答（正常・一部だけ経路なし・エラー）から所要時間の配列を作れること
- キャッシュ: 同じ丸めた地点・同じ移動手段なら 2 回目は呼ばない。10 分を過ぎたら呼ぶ
- 直線距離からの計算: 徒歩 60／自転車 180／（API 失敗時のみ）車 300／電車 400／バス 200 m／分で割り、切り上げ、最低 1 分
- 表示文言（4.5.7）: 「徒歩 約 6 分」「自転車 約 12 分」「車 約 12 分」のように `〈移動手段〉 約 N 分` で統一

## 関連する受入条件

- 要件定義書 8 章 79
