# Task 1: メニュー項目の差し替えと表示条件

> 出典: [menu-bar.md](../../../user-stories/shared-ui/menu-bar.md)
> インデックス: [menu-bar-v3](00-index.md)

## 依存

- theme Task 1

## 実装内容

- `menu-bar-config.ts` を ホーム（`/`、家のアイコン）・しおり（`/itineraries`）・通知（`/notifications`、未読バッジ）・マイページ（`/mypage`）の 4 項目にする。アイコンは 家・ブックマーク・ベル・ユーザー
- 未ログインの `/`・`/login`・`/signup`・`/admin/**` では表示しない（`AppMenuBar` の判定を更新）
- 選択中の項目をアクセント色にする

## 成果物

- `src/components/layout/menu-bar-config.ts`
- `src/components/layout/AppMenuBar.tsx`

## テスト要件

### 単体テスト
- 4 項目の順序・遷移先・アイコンが定義どおりであること
- 未ログインの `/` と `/admin` で非表示になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- メニューバーが「ホーム・しおり・通知・マイページ」の 4 項目（ホームは家のアイコン）で、パソコン幅では左サイドバーになること（受入条件44）
