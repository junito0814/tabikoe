# Task 1: 上部の地図を 2 本指で操作できるようにし、拡大縮小ボタンを整理する

> 出典: [map-sheet.md](../../../user-stories/shared-ui/map-sheet.md)
> インデックス: [map-sheet](00-index.md)
> 要件定義書 4.5.8

## 実装内容

- `GoogleMap` に「2 本指でだけ操作できる」状態を足す（`gestureHandling: "cooperative"`）。今の `interactive` は「全部止める／全部使える」の 2 値なので、`gesture: "none" | "cooperative" | "greedy"` のような形に整理する
- `StaticSpotMap`（上部の地図。SC-04 スポット別・SC-05 投稿詳細で使用）
  - 2 本指で拡大・縮小・移動できるようにする
  - 地図全体を覆っていたリンクを外し、右下に **「地図を全画面に」ボタン**を置く（行き先は今と同じ `?back=` つきの SC-02）
  - 拡大・移動したら、その隣に「戻す」を出す（初期の中心・ズームに戻す。地図の `idle` で初期値と違うかを見る）
  - 拡大縮小ボタン（＋ −）は出さない
- `map-styles.ts` の `buildMapOptions`: 拡大縮小ボタンを「指で触れる端末では出さない」にする（`window.matchMedia("(pointer: coarse)")`。SSR とテストでは出す側に倒す）
- `ItineraryStaticMap`（しおりの上部の地図）も同じ扱いにする

## テスト要件

### 単体テスト
- `buildMapOptions`: 指で触れる端末では `zoomControl: false`、それ以外では `true`
- `StaticSpotMap`: 地図全体のリンクが無く、「地図を全画面に」ボタンが `?back=` つきの SC-02 を指すこと
- `StaticSpotMap`: 初期表示では「戻す」が出ず、地図を動かしたあとに出ること。押すと初期の中心・ズームに戻ること
- `GoogleMap`: `gesture` の値が Google マップのオプションに正しく渡ること

## 関連する受入条件

- map-sheet.md の受入条件 1〜4
