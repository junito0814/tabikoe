import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppMenuBar } from "@/components/layout/AppMenuBar";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { APP_BACKGROUND } from "@/lib/theme/colors";
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
  // loading-feedback Task 1: iPhone のホーム画面に置いたとき、単独のアプリとして開く（4.5.11 の場面 1）
  appleWebApp: {
    capable: true,
    title: "タビコエ",
    statusBarStyle: "default",
  },
};

/**
 * loading-feedback Task 1: ブラウザの上下の帯の色（4.5.11 の場面 1）
 * 出典: docs/tasks/shared-ui/loading-feedback/01-app-shell-color.md
 *
 * 【初心者向け】`theme-color` はスマホのブラウザの帯（上のアドレスバーや下の余白）の色。
 * 何も指定しないと白のままで、ダークモードのときに画面の地（紺寄りの黒）と食い違う。
 * OS の設定に合わせて 2 つ書くと、ブラウザがその場に合う方を選ぶ。
 * 値は globals.css の `--app` と同じ（src/lib/theme/colors.ts。ずれはテストで止めている）。
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_BACKGROUND.light },
    { media: "(prefers-color-scheme: dark)", color: APP_BACKGROUND.dark },
  ],
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
  // performance Task1: ここは「ログインしているか」だけ分かればよいので、手元の署名検証（getClaims）で済ませる。
  // 【初心者向け】この共通レイアウトは 404 ページを含む全ページで動くので、ここで例外を投げるとビルドごと止まる
  // （環境変数の入れ忘れでデプロイが丸ごと失敗した）。読めなければ「未ログイン」として描き、原因はログに出す。
  // 実際のページを開けば、そのページ自身が同じ環境変数のエラーを出すので、設定漏れは見逃されない。
  const user = await getMenuBarUser();

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

/** メニューバーの出し分け用に、ログイン状態だけを見る。失敗しても画面は描く（未ログイン扱い） */
async function getMenuBarUser() {
  try {
    return await getAuthUserFromClaims(await createClient());
  } catch (error) {
    console.error("[layout] ログイン状態を確認できませんでした:", error);
    return null;
  }
}
