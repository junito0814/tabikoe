import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // post-creation-v3 Task4: ffmpeg の実行ファイル（ffmpeg-static）はバンドルせず、そのままサーバーに同梱する
  serverExternalPackages: ["ffmpeg-static"],
  /*
   * #861（2026-10-09）: **実行ファイルを確実に持っていく。**
   *
   * 【初心者向け】`serverExternalPackages` は「まとめ直さずにそのまま置く」という指示で、
   * 「必ず持っていく」とは言っていません。Next.js は**どのファイルが要るかをコードから辿って**
   * 荷造りしますが、`await import("ffmpeg-static")` のような**動的な読み込みは辿れません**。
   *
   * 実際、本番相当のビルドで荷物の一覧（.nft.json）を数えたところ、
   * **ffmpeg-static はどの関数にも入っていませんでした**（2026-10-09）。
   * 手元には node_modules があるので動いてしまい、**本番だけ落ちる**たちの悪い形です。
   * そこで、動画を扱う口に「このフォルダも持っていく」と明示します。
   */
  outputFileTracingIncludes: {
    "/api/posts/photos": ["./node_modules/ffmpeg-static/**"],
  },
  // performance Task1（2026-09-22）: 直前に見た画面（動的ページ）は 30 秒間はサーバーへ行かずに表示する（戻るが一瞬になる）
  experimental: { staleTimes: { dynamic: 30 } },
  /*
   * #901（2026-10-17）: **器（画面の骨組み）を関数抜きで配る。**
   *
   * 【初心者向け】本番で測ったところ、**関数が立ち上がるのに初回 2.44 秒**かかっていました
   * （2 回目以降 0.21 秒）。無料枠のサーバーレスで、使われていない間にインスタンスが落ちるためで、
   * コードの問題ではありません（#900 に調査）。
   *
   * ほかの SNS がこの問題を持たないのは、**器を端末が持っている**からです。
   * Instagram や X は器がアプリ本体に入っていて、取りに行くのはデータだけ。
   * いまのタビコエは**器も毎回サーバーで作って**いました。
   *
   * `cacheComponents` を立てると、Next.js は**まず器だけを静的に作り**、
   * URL ごとに変わる中身を後から流し込みます（ビルドの一覧で `ƒ` → `◐` になる）。
   * `partialPrefetching` は、その器を `<Link>` が先に取ってくるようにするもので、
   * **同じ行き先への 20 本のリンクが 1 つの器を共有**します（1 画面から 20 本飛ばしても増えない）。
   *
   * 2 つはセットです ── `partialPrefetching` は `cacheComponents` が無いと使えません。
   */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
