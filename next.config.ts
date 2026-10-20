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
  // #990: 応答ヘッダ（値と理由はファイル末尾）
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
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

/*
 * #990 の実装（2026-10-18）: 応答ヘッダ
 * 出典: 要件定義書 7.2「応答ヘッダ」、8 章 103・104
 *
 * 【初心者向け】ページを返すとき、本文（HTML）とは別に**ブラウザ宛ての短い指示**を付けられます。
 * 「他サイトに埋め込まないで」「中身を推測しないで」といったお願いで、ブラウザがそれを守ります。
 *
 * `Strict-Transport-Security` は**書きません** ── Vercel が既に送っているためです
 * （2026-10-18 に本番の応答を実測して確認）。
 */

/**
 * CSP で許可する出どころ。**推測せず、コードから洗い出したもの**（要件 7.2）。
 *
 * 【初心者向け】Supabase の住所だけは環境によって変わるので、環境変数から組み立てます。
 * この値はブラウザ側にも渡っている公開情報なので、ここに書いても新しく漏れるものはありません。
 */
function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/** 地図が読み込むもの。地図は内部で読み込み先を増やすので、Report-Only で実測してから絞る */
const GOOGLE_MAPS = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
/*
 * 地図が **自分用に読むフォント**（2026-10-20 に Report-Only で実測して判明。要件 7.2）。
 *
 * 【初心者向け】地図は矢印の記号や操作ボタンの字に Google のフォント（Google Sans・Roboto）を使います。
 * 読み込みは 2 段階で、**別の指示に書かないと止まります**。
 *   1. `fonts.googleapis.com` … 「どのフォントを使うか」を書いた CSS   → style-src
 *   2. `fonts.gstatic.com`    … フォントの実体（.woff2）              → font-src
 * ここを入れ忘れると、**有効化した時点で地図の中の文字が崩れます**。
 */
const GOOGLE_FONT_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONT_FILES = "https://fonts.gstatic.com";
/** 地図が出す画像（写真・ストリートビュー） */
const GOOGLE_IMAGES = ["https://maps.gstatic.com", "https://*.googleapis.com", "https://*.ggpht.com"];

function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  return [
    "default-src 'self'",
    /*
     * `'unsafe-inline'` が残る理由（要件 7.2「CSP の限界」）:
     * いちばん強い nonce 方式は **Partial Prerendering と両立しません**
     * （Next のドキュメント content-security-policy.md に明記）。採ると #901 の
     * 「器を関数抜きで配る」が無効になるため、ここは緩いままにして
     * **持ち出しを止める側**（connect-src / img-src）で守ります。
     */
    `script-src 'self' 'unsafe-inline' ${GOOGLE_MAPS.join(" ")}`,
    // 地図が自分で style を差し込むため（`'unsafe-inline'`）と、地図のフォント指定の CSS
    `style-src 'self' 'unsafe-inline' ${GOOGLE_FONT_CSS}`,
    /*
     * `lh3.googleusercontent.com` は **Google ログインのアイコン**。
     * `users.avatar_url` にその URL をそのまま保存しているので、
     * ここを外すと**Google でログインした人のアイコンが全部消えます**。
     */
    `img-src 'self' data: blob: ${supabase} https://lh3.googleusercontent.com ${GOOGLE_IMAGES.join(" ")}`,
    // 動画の再生（署名付き URL）と、切り取り中の blob
    `media-src 'self' blob: ${supabase}`,
    // アプリのフォントは .woff2 をリポジトリに持っている（next/font/local）。追加分は地図が読む実体
    `font-src 'self' ${GOOGLE_FONT_FILES}`,
    // Realtime は使っていないので wss は入れない
    `connect-src 'self' ${supabase} ${GOOGLE_MAPS.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    // <base> の書き換えと、フォームの送信先のすり替えを防ぐ
    "base-uri 'self'",
    "form-action 'self'",
    // X-Frame-Options と同じ目的（新しいブラウザはこちらを見る）
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const SECURITY_HEADERS = [
  // 他サイトに埋め込ませない（クリックジャッキング）
  { key: "X-Frame-Options", value: "DENY" },
  // 「画像と書いてあるが中身は別物では」という推測をさせない
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 外部サイトへ移るとき、URL ごと渡さない（現代のブラウザの既定と同じ値）
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /*
   * 使わない機能を閉じる。**位置情報は使うので `self` を残します**
   * （閉じると地図の現在地が壊れます）。
   */
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  /*
   * **止めない形（Report-Only）で始めます。** 地図は内部で読み込み先を増やすので、
   * 許可先を推測で書くと必ず漏れ、漏れると地図が白くなります。
   * 実際に触って違反を集め、**2026-11-01 までに止める形へ切り替えます**（要件 7.2）。
   */
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
];

export default nextConfig;
