# Task 1: CSS 変数への色集約（ライト）

> 出典: [theme.md](../../../user-stories/shared-ui/theme.md)
> インデックス: [theme](00-index.md)

## 依存

- なし

## 実装内容

- `src/app/globals.css` にワイヤーフレーム「配色」の値を `--color-bg`・`--color-surface`・`--color-surface-tint`・`--color-text`・`--color-text-muted`・`--color-border`・`--color-accent`・`--color-accent-pressed`・`--color-saved`・`--color-done`・`--color-star`・`--color-sky-gradient` として定義し、Tailwind v4 の `@theme` で `bg-app`・`text-app` 等のユーティリティに束ねる
- 検索トップ用のグラデーション（`#BFDDF7` → `#E4F1FC` → `#F3F8FD`）を変数化する
- `body` の背景・文字色を変数に切り替える

## 成果物

- `src/app/globals.css`
- `docs/user-stories/shared-ui/theme.md` に変数名の対応表を追記

## テスト要件

### 単体テスト
- 変数名と値の対応が theme.md の表と一致することをスナップショットで検証する

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 検索トップだけにグラデーション背景があり、他の画面が白地であること
