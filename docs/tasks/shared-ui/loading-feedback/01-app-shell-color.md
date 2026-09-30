# Task 1: 起動直後の色（マニフェストと帯の色）

> 出典: [loading-feedback.md](../../../user-stories/shared-ui/loading-feedback.md)
> インデックス: [loading-feedback](00-index.md)
> 要件定義書 4.5.11 の場面 1・4.5.9（ロゴ）・4.5.5（配色）

## 依存

なし

## 背景

本番の HTML を調べたところ、`<meta>` にあるのは `viewport` と `description` だけだった。ウェブアプリのマニフェストも `theme-color` も iOS 用の指定も無い。そのため次の 2 つが起きている。

- ホーム画面に置いたアイコンから開くと、アプリの色ではなく**白い画面が一瞬出る**
- ブラウザの上下の帯が白のままで、ダークモードのときに画面の地（紺寄りの黒）と食い違う

なお最初の HTML には画面の中身（ロゴ・キャッチフレーズ・ボタン）が入っており、本番の実測で 0.33〜0.63 秒で届いている。**「真っ白のまま待つ」問題は無い**ので、直すのは起動直後の下地の色だけ。

## 2026-09-30 の訂正（実機で分かったこと）

**マニフェストの `background_color` では iOS の起動画面は青くならない。** 実機（ホーム画面に追加して起動）で確認したところ**白いまま**だった。

- iOS は**マニフェストの色を起動画面に使わない**（Android は使う）
- iOS では **`apple-touch-startup-image`** で、**画面の大きさごとに起動画面の画像**を渡す必要がある。渡さない限り白
- マニフェストと `theme-color` 自体は正しく効いている（単独アプリとして開き、アドレスバーが消えることを確認済み）

直し方は Bug の Issue に書く。マニフェストの `background_color` は Android のために残す。

## 実装内容

1. `src/app/manifest.ts`（Next.js のマニフェスト規約）を新設する
   - `name` / `short_name`: タビコエ
   - `description`: あなたのコエが、だれかのタビへ。
   - `start_url`: `/`
   - `display`: `standalone`
   - `background_color`: **`#2F7FD8`**（空の青。4.5.9 のロゴの地と同じ。白い一瞬をアプリの色にするのが目的なので、地の白ではなくロゴの青に合わせる）
   - `theme_color`: `#2F7FD8`
   - `icons`: 既存の `src/app/icon.svg` と `src/app/apple-icon.png` を指す
2. `src/app/layout.tsx` に `viewport` を足す（`export const viewport: Viewport`）
   - `themeColor` を**OS の設定で出し分ける**。ライトは地の白、ダークは地の紺寄りの黒。値は `globals.css` の `--app` と同じにする
   - 既定の `width=device-width, initial-scale=1` は変えない
3. `metadata` に `appleWebApp`（`capable: true`、`title`、`statusBarStyle`）を足す

**色を直書きしない。** `globals.css` の CSS 変数と同じ値を使うことを、ファイル冒頭のコメントで明示する（4.5.5 の実装方針）。

## 成果物

- `src/app/manifest.ts`
- `src/app/layout.tsx`（`viewport` と `appleWebApp` の追加）
- `src/app/manifest.test.ts`

## テスト要件

### 単体テスト
- マニフェストが返す `background_color` と `theme_color` が `#2F7FD8`（4.5.9 のロゴの地と同じ）であること
- `display` が `standalone`、`start_url` が `/` であること
- アイコンの参照先が実在すること（`src/app/icon.svg`・`src/app/apple-icon.png`）
- `viewport.themeColor` がライトとダークの 2 件を持ち、値が `globals.css` の `--app` と一致すること

### 結合テスト
- 本番ビルドの HTML に `<link rel="manifest">` と `<meta name="theme-color">` が 2 件（ライト・ダーク）出ること

### E2Eテスト
- **実機で確かめる**（要件 8 章 85）。iPhone のホーム画面にアイコンを置いて開き、起動直後の下地が白ではなく空の青になること。**iOS の起動画面の扱いは版によって違うため、効かない場合はその旨を PR 本文に書く**（[AGENTS.md](../../../../AGENTS.md) 21）

## 関連する受入条件

- ホーム画面に置いたアイコンから開いたとき、起動直後の下地が白ではなく空の青になり、ブラウザの帯の色が画面の地の色と揃っていること
