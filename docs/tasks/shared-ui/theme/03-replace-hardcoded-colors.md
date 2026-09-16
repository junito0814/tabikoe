# Task 3: 直書き色の置き換えとコントラスト確認

> 出典: [theme.md](../../../user-stories/shared-ui/theme.md)
> インデックス: [theme](00-index.md)

## 依存

- Task 1
- Task 2

## 実装内容

- `src/` 内の 16 進の直書き（`#C4703F`・`#FBF6F0`・`#3D3A35`・`#9C9488`・`#E8E1D8` など約 400 箇所）を変数ユーティリティに置き換える。`pin-styles.ts`・`pin-marker-icon.ts` の SVG 用の色は `getComputedStyle` で変数を読む関数経由にする
- ESLint（`no-restricted-syntax` で `#[0-9a-f]{6}` を禁止）または `scripts/check-colors.sh` で再発を防ぐ
- 主要ボタン（SC-00・SC-03・SC-04・SC-23）がアクセント色、それ以外が白地＋枠線になっていることを見直す
- ライト／ダークで本文・ボタンのコントラスト比 4.5:1 以上を確認する（axe または手計算）

## 成果物

- 置き換え済みの各コンポーネント
- `eslint.config.mjs` のルール追加または `scripts/check-colors.sh`

## テスト要件

### 単体テスト
- `pin-marker-icon` が変数から色を解決することを検証する

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- コンポーネントに 16 進の色が直書きされておらず、CSS 変数を参照していること
- 両モードで本文・ボタンのコントラスト比が 4.5:1 以上であること
