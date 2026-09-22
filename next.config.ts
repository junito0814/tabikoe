import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // post-creation-v3 Task4: ffmpeg の実行ファイル（ffmpeg-static）はバンドルせず、そのままサーバーに同梱する
  serverExternalPackages: ["ffmpeg-static"],
  // performance Task1（2026-09-22）: 直前に見た画面（動的ページ）は 30 秒間はサーバーへ行かずに表示する（戻るが一瞬になる）
  experimental: { staleTimes: { dynamic: 30 } },
};

export default nextConfig;
