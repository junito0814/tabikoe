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
};

export default nextConfig;
