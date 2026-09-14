import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static は同梱バイナリを __dirname 基準で解決するため、バンドルせず Node の require に任せる
  serverExternalPackages: ["ffmpeg-static"],
  // 外部化したパッケージの実行ファイルは自動トレースに乗らないことがあるため、
  // 動画処理ルートのデプロイ成果物に明示的に含める（Vercel での ffmpeg 同梱、要件定義書9章#5）
  outputFileTracingIncludes: {
    "/api/posts/videos": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
