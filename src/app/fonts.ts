/**
 * アプリ全体で使う Web フォントの定義（next/font/google）
 *
 * 【初心者向け】`next/font` は Google Fonts をビルド時に取り込み、自前のドメインから配信する仕組み。
 * ここで作った `outfit`・`lora` を layout.tsx の className に渡すと、そのフォントが使える。
 * Outfit は見出しやボタンの英数字、Lora はロゴ「タビコエ」まわりのセリフ体に使う。
 * 日本語はシステムフォント（Hiragino / Noto Sans JP）にフォールバックする。
 */
import { Outfit, Lora } from "next/font/google";

export const outfit = Outfit({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

export const lora = Lora({
    subsets: ["latin"],
    weight: ["600", "700"],
});
