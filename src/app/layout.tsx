import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppMenuBar } from "@/components/layout/AppMenuBar";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { LAUNCH_GROUND } from "@/lib/theme/colors";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * #662（2026-10-03）: iOS の起動画面の画像の**宣言を外した**。
 *
 * 【初心者向け】ここには `apple-touch-startup-image` の宣言が 11 枚あった。
 * 「この大きさの端末ならこの画像を起動画面に出す」という Apple 独自の指定で、
 * 2026-09-30 から 3 回直して **3 回とも効かなかった**（実機で、一致する宣言があり・
 * HTML にも出ており・画像も配信されているのに出ないことまで確かめた）。
 *
 * **外した理由**: iOS 16.4 以降は、**宣言が 1 つも無いとき**にマニフェスト
 * （`background_color`・アイコン・名前）から起動画面を自分で作る、という挙動が報告されている。
 * 効かない宣言が残っていることで、その道が塞がれている可能性があるため。
 * 確証は無い（Apple はこの仕組みを文書化していない）。**これが 5 回目で最後の試み**。
 *
 * **画像（`public/splash/*.png`）は消していない。** 戻せるようにするため。
 * 実行時には読み込まれない（iOS が要求したときだけ）ので、速度には影響しない。
 */

export const metadata: Metadata = {
  title: "タビコエ",
  description: "あなたのコエが、だれかのタビへ。",
  // loading-feedback Task 1: iPhone のホーム画面に置いたとき、単独のアプリとして開く（4.5.11 の場面 1）
  appleWebApp: {
    capable: true,
    title: "タビコエ",
    statusBarStyle: "default",
    // #662: `startupImage` は外した（上のコメント参照）。iOS にマニフェストから
    // 起動画面を作らせる道が、効かない宣言で塞がれている可能性があるため
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
  /*
   * loading-feedback Task 10（2026-10-02）: 帯の色を**起動の地の色**に揃える。
   *
   * 【初心者向け】ここは 2026-09-30 まで画面の地の色（白・紺黒）を指定していた。
   * ところがマニフェスト（`manifest.ts`）は `theme_color` に**青**を宣言しており、
   * **この meta がそれを上書きしていた**。つまり同じ PR #615 の中で、
   * 起動を青くするために入れた指定を、もう 1 つの指定が白に塗り戻していた。
   *
   * iOS で単独のアプリとして開くと、**描画が始まる前に見えている地**がこの色になる
   * （と見込んでいる。確証はないが、心当たりがここしかない）。白いままにする理由は
   * どこにも無いので、マニフェストの宣言に合わせる。
   *
   * **副作用を承知のうえでの変更。** `theme-color` は上の帯の色にもなるので、
   * ライトでは普段も青い帯が見える。ダークの `#0e1e3d` は地の `#0b1220` と
   * ほとんど差が無いので気づかない。
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: LAUNCH_GROUND.light },
    { media: "(prefers-color-scheme: dark)", color: LAUNCH_GROUND.dark },
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
        <LaunchCover />
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


/**
 * loading-feedback Task 10（2026-10-02）: 起動のときの覆い
 * 出典: docs/tasks/shared-ui/loading-feedback/10-launch-screen.md
 *       要件定義書 4.5.11「場面 1 の決着」・8 章 97
 *
 * 【初心者向け】ホーム画面のアイコンから開いたとき、**白い画面を出さない**ための覆い。
 *
 * ここでいちばん大事なのは「**外部ファイルを 1 つも待たずに描けること**」。
 * ふつうの作り方（別の CSS ファイル・画像ファイル・React の部品）だと、
 * それらが届くまで描けず、**白を消したい時間帯にちょうど間に合わない**。
 * そこで次をすべて守っている。
 *
 *   - `<style>` をこの場に書く（外部 CSS の往復を待たない）
 *   - `<body>` のいちばん上に置く（他の要素の構築を待たない）
 *   - ロゴは**この場に書いた SVG**（画像ファイルの往復を待たない）
 *   - **JavaScript を使わない**（344KB の読み込みと実行を待たない。`"use client"` にしない）
 *
 * 動きは「**静止して待ち、去るときだけ動く**」（Instagram と同じ考え方）。
 * 描画が始まる前は何も出せないので、**入場の動きを見せる余地が無い**ため。
 * 保持 600ms →（軽く拡大しながら）フェード 250ms（#663 で 300ms から変更。一瞬すぎて見えなかった）。
 *
 * `pointer-events: none` を最初から付けているのは、消える前に触っても
 * **下の本物に届くようにする**ため（覆いは飾りで、中身はもう描けている）。
 *
 * ブラウザのタブで開いたときにも出る。**単独アプリのときだけに絞ることもできる**が
 * （`@media (display-mode: standalone)`）、その指定が端末に無視されると
 * **覆いごと出なくなる**。起動画像でまさにそれが起きたので、ここでは絞らない。
 */
function LaunchCover() {
  return (
    <>
      <style>{`
#launch-cover{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;pointer-events:none;background:${LAUNCH_GROUND.light};animation:launch-leave 250ms ease-in 600ms forwards}
#launch-cover svg{width:min(28vw,128px);height:auto}
@keyframes launch-leave{to{opacity:0;transform:scale(1.08);visibility:hidden}}
@media (prefers-color-scheme:dark){#launch-cover{background:${LAUNCH_GROUND.dark}}}
@media (prefers-reduced-motion:reduce){#launch-cover{animation:launch-fade 250ms linear 600ms forwards}}
@keyframes launch-fade{to{opacity:0;visibility:hidden}}
`}</style>
      <div id="launch-cover" aria-hidden="true">
        {/* src/app/icon.svg と同じ形（要件 4.5.9）。地が青なので白で描く */}
        <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
          <circle cx="36" cy="32.8" r="11.5" fill="#fff" />
          <path d="M32 42L36 51L40 42Z" fill="#fff" />
          <circle cx="36" cy="36" r="22" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="4.2" />
          <circle cx="36" cy="36" r="30" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="3.6" />
        </svg>
      </div>
    </>
  );
}
