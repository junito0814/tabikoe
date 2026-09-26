# Task 1: 全画面の地図では、モードを問わず現在地を出す

> 出典: [map-current-location.md](../../../user-stories/map-search/map-current-location.md)
> インデックス: [map-current-location](00-index.md)
> 要件定義書 4.5.10

## 実装内容

- `MapScreen`: 開いたときに 1 回だけ現在地を取りに行く処理を足す
  - 今の「中心が決まっていないときだけ現在地を待つ」処理（`initial` が無いときの `resolveCenter`）とは**別に**する。あちらは「地図をどこに開くか」を決めるためのもので、こちらは「点を出すだけ」
  - すでに現在地が入っているとき（探すモード・復元）は何もしない
  - **地図は動かさない**（`panTo` を呼ばない）。`setCurrentLocation` だけ
  - 取れなかったら何もしない（エラーも出さない）
- しおりの地図（`mode=itinerary`）でも同じ扱いにする（SC-02 の 1 つのモードなので）
- **`MyMapScreen`（あしあと）は変更しない**。自分の記録を見る画面なので現在地は出さない（2026-09-26 決定）
- 上部の地図（`StaticSpotMap`・`ItineraryStaticMap`）・`PostLocationMap`（SC-03）・スポット手動登録モーダルも変更しない

## テスト要件

### 単体テスト
- `MapScreen`: `?spot=…&lat=…&lng=…`（中心つき）で開いても現在地の点が出ること
- そのとき地図の中心が動かないこと（`panTo` が呼ばれないこと）
- 位置情報が取れないときに例外にならず、エラーも出ないこと
- 探すモードでは今までどおり現在地を中心に開くこと（既存のテストが通ること）
- `MyMapScreen`（あしあと）には現在地の点が出ないこと

## 関連する受入条件

- map-current-location.md の受入条件すべて
