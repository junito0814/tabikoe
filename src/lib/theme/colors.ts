/**
 * loading-feedback Task 1: 画面の「外側」で使う色
 * 出典: docs/tasks/shared-ui/loading-feedback/01-app-shell-color.md
 *       要件定義書 4.5.11（読み込み中の見せ方・場面 1）・4.5.5（配色）・4.5.9（ロゴ）
 *
 * 【初心者向け】アプリの色はふつう globals.css の CSS 変数に集めてある（4.5.5）。
 * ところがマニフェスト（ホーム画面のアイコンから開いたときの設定）とブラウザの帯の色は、
 * CSS ではなく **HTML を作る前**に決めるので、CSS 変数を読めない。そこでここに同じ値を置く。
 *
 * 値がずれると起動直後だけ色が違う、という分かりにくい不具合になるので、
 * colors.test.ts で globals.css・icon.svg と一致しているかを毎回確かめている。
 */

/** ロゴの地の色（空の青）。ダークモードでも変えない（4.5.9） */
export const BRAND_GROUND = "#2F7FD8";

/** 画面の地の色。globals.css の `--app` と同じ値 */
export const APP_BACKGROUND = {
  light: "#ffffff",
  dark: "#0b1220",
} as const;
