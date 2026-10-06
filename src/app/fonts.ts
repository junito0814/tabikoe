/**
 * アプリ全体で使う Web フォントの定義
 *
 * 2026-10-06: `next/font/google` から `next/font/local` に変えた（#748 の CI が落ちた件）。
 *
 * 【初心者向け】`next/font/google` は**ビルドのたびに Google のサーバーからフォントを落として**きます。
 * そのため、GitHub Actions から Google に繋がらなかった回だけビルドが落ちるという
 * 「同じコードなのに通ったり落ちたりする」状態になっていました（#720 で 1 度、2026-10-06 に再発）。
 * 落ちるときの文言は `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` です。
 *
 * そこで **.woff2 をリポジトリに入れて** `next/font/local` で読むようにしました。
 * ビルド中に外へ通信しないので、もう落ちません。見た目は今までと同じです
 * （同じ Google Fonts の、同じ可変フォントの latin 部分集合をそのまま置いています）。
 * 書体はすべて SIL Open Font License 1.1 で、自前配信が認められています（fonts/LICENSE.md）。
 *
 * - Outfit: 見出しやボタンの英数字
 * - Lora: ロゴ「タビコエ」まわりのセリフ体
 * - Geist / Geist Mono: `--font-sans` / `--font-mono`（globals.css）に渡す
 * 日本語はシステムフォント（Hiragino / Noto Sans JP）にフォールバックする。
 */
import localFont from "next/font/local";

/*
 * 【初心者向け】`fallback` の並びが 2 か所に同じものを書いてあります（約束 14 に反して見えます）。
 * これは `next/font` の決まりで、**値を変数にまとめられない**ためです。まとめると
 * `Font loader values must be explicitly written literals.` でビルドが落ちます
 * （ビルド時にソースを読んで解釈する仕組みなので、変数の中身が分からない）。
 */

export const outfit = localFont({
    src: "./fonts/Outfit-latin.woff2",
    // 可変フォントなので、1 ファイルで 100〜900 のすべての太さを出せる
    weight: "100 900",
    style: "normal",
    display: "swap",
    variable: "--font-outfit",
    fallback: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Noto Sans JP", "sans-serif"],
});

export const lora = localFont({
    src: "./fonts/Lora-latin.woff2",
    weight: "400 700",
    style: "normal",
    display: "swap",
    variable: "--font-lora",
    fallback: ["Hiragino Mincho ProN", "Yu Mincho", "serif"],
});

export const geistSans = localFont({
    src: "./fonts/Geist-latin.woff2",
    weight: "100 900",
    style: "normal",
    display: "swap",
    variable: "--font-geist-sans",
    fallback: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Noto Sans JP", "sans-serif"],
});

export const geistMono = localFont({
    src: "./fonts/GeistMono-latin.woff2",
    weight: "100 900",
    style: "normal",
    display: "swap",
    variable: "--font-geist-mono",
    fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
