# Task 4: ピン種別表示・優先順位ルールの統合

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display](00-index.md)

## 依存

- [Task 3: 全体マップ画面（SC-02）UI実装](03-map-screen-ui.md)
- shared-ui/pin-display-rules [Task2: 地図コンポーネントへのピン種別表示の組み込み](../../shared-ui/pin-display-rules/02-map-pin-integration-interface.md)

## 実装内容

- shared-ui/pin-display-rules Task2で提供される描画インターフェース（種別prop：`normal`／`wishlist`／`posted`）を、Task3の地図コンポーネントに組み込む
- 「全体」タブにおいて、自分の投稿があり同時に「行きたい」保存もしているスポットは、`wishlist`ではなく`normal`（通常ピン）として描画する（3.4.1・3.6.5準拠の優先順位ルール）

## 成果物

- SC-02におけるピン種別の描画統合

## テスト要件

### 単体テスト
- 投稿済み＋「行きたい」保存済みのスポットについて、「全体」タブ上では`normal`種別で描画されることを検証する

### 結合テスト
- テスト用データ（投稿済み・行きたいのみ・両方該当の3パターン）を用いて、それぞれ正しい種別のピンが描画されることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ピンの区別が色のみに依存せず、形状・アイコンでも判別できること
- 自分の投稿があり同時に「行きたい」保存もしているスポットが、「全体」タブ上で通常ピンとして表示されること
