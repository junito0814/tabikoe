# Task 2: 長押しでピンを立てる

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)
> インデックス: [pin-interaction-v3](00-index.md)

## 依存

- map-display-v3 Task 2

## 実装内容

- `useLongPress`：`touchstart` から 500ms 以内に `touchmove`（10px 超）・`touchend` が無ければ長押しと判定。マウスは `contextmenu`。Google Maps の `mousedown`／`mouseup`／`dragstart` イベントと組み合わせ、ドラッグ中は発火させない
- 長押し点に一時ピンを立て、吹き出し「この地点 [ここに投稿]」→ `/posts/new?lat&lng`。地図タップで一時ピンを消す。ダブルタップはズームのまま

## 成果物

- `src/components/map/use-long-press.ts`
- `src/components/map/MapScreen.tsx`（一時ピン）

## テスト要件

### 単体テスト
- 500ms 未満・移動あり・ドラッグ中で発火しないこと、500ms 静止で発火すること（タイマーをモック）

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 長押し中に指を動かした場合や 500ms 未満ではピンが立たず、ダブルタップではズームだけが起きること
