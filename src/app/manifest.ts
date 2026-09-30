import type { MetadataRoute } from "next";
import { BRAND_GROUND } from "@/lib/theme/colors";

/**
 * loading-feedback Task 1: ウェブアプリのマニフェスト
 * 出典: docs/tasks/shared-ui/loading-feedback/01-app-shell-color.md
 *       要件定義書 4.5.11（場面 1）・4.5.9（ロゴ）
 *
 * 【初心者向け】`app/manifest.ts` は Next.js の決まった名前のファイルで、これを置くと
 * `/manifest.webmanifest` が配信され、`<link rel="manifest">` が自動で入る。
 * ホーム画面に置いたアイコンから開いたときの「アプリとしてのふるまい」をここで決める。
 *
 * `background_color` を**ロゴの地の青**にしているのが今回の要点。
 * 何も指定しないと起動直後が白く光り、そのあとアプリの画面に変わる。
 * ロゴと同じ青にすると、アイコンから画面までが同じ色でつながる（要件 4.5.11 の場面 1）。
 * 画面の地の白ではなく青にしているのは、消したいのが「白い一瞬」そのものだから。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "タビコエ",
    short_name: "タビコエ",
    description: "あなたのコエが、だれかのタビへ。",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_GROUND,
    theme_color: BRAND_GROUND,
    icons: [
      // どちらも Next.js のファイル規約（src/app/icon.svg・src/app/apple-icon.png）で配信されているもの
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
