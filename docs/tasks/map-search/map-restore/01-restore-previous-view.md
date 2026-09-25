# Task 1: 詳細を見る前の画面をそのまま復元する

> 出典: [map-restore.md](../../../user-stories/map-search/map-restore.md)
> インデックス: [map-restore](00-index.md)
> 要件定義書 3.4.3「復元の判定」・3.4.6「戻ったときの復元」・8章 46

## 実装内容

- `lib/map/map-state.ts`
  - `MapState` に `openedAt`（探すモードを開いたときの現在地）と `activeSpotId`（選んでいたカード）を足す
  - `shouldRestoreMapState` の判定を「同じ入口か」だけにし、探すモードでは `openedAt` と今回の現在地を 500m で比べる。現在地が無いときは復元する
- `MapScreen`
  - 保存時に `openedAt`（復元時は引き継ぐ）と `activeSpotId` を含める
  - 復元時、`activeSpotId` を `NearbyVoices` に渡して初期の選択カードにする
- `NearbyVoices`
  - `initialActiveSpotId` を受け取り、読み込み後にそのカードへ横スクロールして中央に置き、親へ知らせる（ピンの強調と地図の中心が合う）

## テスト要件

### 単体テスト
- `shouldRestoreMapState`: 入口が同じなら中心が離れていても復元する。探すモードで `openedAt` が 500m 超なら復元しない。現在地が無ければ復元する
- `MapState` の読み書きで `openedAt`・`activeSpotId` が往復すること（壊れた値は無視）
- `NearbyVoices`: `initialActiveSpotId` のカードが選ばれた状態で始まること

## 関連する受入条件

- 要件定義書 8 章 46
