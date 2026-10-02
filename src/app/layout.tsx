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

/**
 * #623: iOS の起動画面の画像。`public/splash/` に置いた 8 枚を、端末の大きさごとに指す。
 * 画像は scratchpad の gen-splash.mjs で作った（空の青 + 4.5.9 のロゴ）。作り直すときも同じ手順で。
 */
const APPLE_STARTUP_IMAGES = [
  { url: "/splash/splash-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
  { url: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  { url: "/splash/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
  /*
   * 受け皿（#623 の 2 度目の修正・2026-10-02）: `media` を書かない 1 枚。
   *
   * 【初心者向け】上の 10 枚は「この大きさの端末ならこの画像」という指定で、**ぴったり
   * 一致しないと使われない**。新しい iPhone が出ると、また一致しないものが増える
   * （実際に 16 Pro と 16 Pro Max が抜けていた）。
   * `media` を書かない 1 枚は**どの端末でも一致する**ので、一覧に無い端末でも白にならない。
   * iOS が縮めて使うが、中身は空の青に中央ロゴなので縮んでも崩れない。
   * このため、受け皿が選ばれても上の 10 枚が選ばれても、見える結果はほぼ同じになる。
   */
  "/splash/splash-1320x2868.png",
];

export const metadata: Metadata = {
  title: "タビコエ",
  description: "あなたのコエが、だれかのタビへ。",
  // loading-feedback Task 1: iPhone のホーム画面に置いたとき、単独のアプリとして開く（4.5.11 の場面 1）
  appleWebApp: {
    capable: true,
    title: "タビコエ",
    statusBarStyle: "default",
    /*
     * #623: 起動直後の白い一瞬を消す。
     *
     * 【初心者向け】**iOS はマニフェストの `background_color` を起動画面に使わない**（Android は使う）。
     * 画面の幅・高さ・解像度が**ぴったり一致する画像**を渡したときだけ、それを起動画面に出す。
     * 一致するものが無ければ白のまま。だから端末の大きさごとに 1 枚ずつ用意する。
     * 中身は空の青（マニフェストの `background_color` と同じ）にロゴを中央へ置いたもの。
     * このアプリは縦向きが前提なので、縦のぶんだけ用意する。
     */
    startupImage: APPLE_STARTUP_IMAGES,
  },
  /*
   * #623 の 2 度目の修正（2026-10-02）: `apple-mobile-web-app-capable` を自分で足す。
   *
   * 【初心者向け】上の `appleWebApp.capable: true` は指定してあるのに、**Next 16 が出す
   * meta の名前は接頭辞の無い `mobile-web-app-capable` だけ**になっていた
   * （node_modules/next/dist/lib/metadata/metadata.js の「--- Apple Web App ---」の節）。
   * 接頭辞なしは新しい決まりの方の名前で、Android などはこれを見る。
   * いっぽう `apple-touch-startup-image`（起動画面）は **Apple の接頭辞付きの方**と
   * 組で使う決まりなので、無いと上の 11 枚ごと見てもらえない恐れがある。
   * Next が出さないぶんを `other` で足して、どちらの名前も揃えておく。
   */
  other: {
    "apple-mobile-web-app-capable": "yes",
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
  /*
   * loading-feedback Task 6（2026-09-30）: 指 2 本の拡大を止める（要件 4.5.12 の 3）
   *
   * 【初心者向け】ホーム画面から単独のアプリとして開く以上、意図しない拡大で
   * 表示が崩れるのを防ぐ。**副作用を承知のうえでの決定**で、見えにくいときに
   * 文字を大きくする逃げ道が無くなる（本文が 11〜13px で 503 か所ある）。
   * 文字の大きさそのものの見直しは提出後（要件 9 章 未決定事項 No.16）。
   *
   * 地図の 2 本指の拡大・縮小は影響を受けない。Google マップが自前で持っている
   * 仕組みで、ページの拡大とは別のため。
   */
  maximumScale: 1,
  userScalable: false,
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
