import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppMenuBar } from "@/components/layout/AppMenuBar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "タビコエ",
  description: "あなたのコエが、だれかのタビへ。",
};

/**
 * 【初心者向け】layout.tsx は全ページの「外枠」。<html><body> と、全画面共通のメニューバーをここで 1 回だけ描き、
 * 各ページ（page.tsx）の中身は `children` として差し込まれる。ページを移動しても layout は作り直されない。
 * `metadata` はブラウザのタブに出るタイトルと説明。フォントは next/font で読み込み、CSS 変数として渡している。
 *
 * 共通メニューバー（要件定義書4.2）はここで全画面に載せる。
 * 表示・非表示の判定はAppMenuBar側がパスで行う（未ログインのホーム・ログイン・新規作成・管理画面では出ない）。
 * バーが描画されている時だけ、スマートフォンでは下部バーの分、PCでは左サイドバーの分の
 * 余白をbodyに確保する（`has-[[data-menu-bar]]`）。
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // menu-bar-v3 Task1: 未ログインのホーム（/）ではメニューバーを出さないため、ここでログイン状態を見る
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col has-[[data-menu-bar]]:pb-[60px] md:has-[[data-menu-bar]]:pb-0 md:has-[[data-menu-bar]]:pl-[200px]">
        <AppMenuBar isAuthenticated={user !== null} />
        {children}
      </body>
    </html>
  );
}
