import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppMenuBar } from "@/components/layout/AppMenuBar";
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
  description: "みんなの旅の記録を、次の旅のヒントに",
};

/**
 * 共通メニューバー（要件定義書4.2）はここで全画面に載せる。
 * 表示・非表示の判定はAppMenuBar側がパスで行う（トップ・ログイン・新規作成・管理画面では出ない）。
 * バーが描画されている時だけ、スマートフォンでは下部バーの分、PCでは左サイドバーの分の
 * 余白をbodyに確保する（`has-[[data-menu-bar]]`）。
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col has-[[data-menu-bar]]:pb-[60px] md:has-[[data-menu-bar]]:pb-0 md:has-[[data-menu-bar]]:pl-[200px]">
        <AppMenuBar />
        {children}
      </body>
    </html>
  );
}
