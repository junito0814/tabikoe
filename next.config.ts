import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // post-creation-v3 Task4: ffmpeg の実行ファイル（ffmpeg-static）はバンドルせず、そのままサーバーに同梱する
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
