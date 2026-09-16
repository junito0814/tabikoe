# Task 3: 下書きピンの吹き出し

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)
> インデックス: [pin-interaction-v3](00-index.md)

## 依存

- map-display-v3 Task 1
- draft Task 3

## 実装内容

- `kind = 'draft'` のピンに「下書き: 〈スポット名または名前のない場所〉 [続きを書く]」の吹き出しを出し、`/posts/new?draft=<id>` へ

## 成果物

- `src/components/map/PinCallout.tsx`（draft 分岐）

## テスト要件

### 単体テスト
- draft の吹き出しに続きを書くリンクがあること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 下書きピンの「続きを書く」で SC-03 が保存時の状態で開くこと
