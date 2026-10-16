/**
 * #952（2026-10-17）: このサイトの住所（絶対 URL）
 * 出典: Issue #952、要件定義書 4.5.18（OG カード）
 *
 * 【初心者向け】リンクカード（OG）に入れる `og:url` は**絶対 URL**でなければなりません
 * （相手のサーバーが読むので、`/posts/xxx` だけでは何のことか分からない）。
 * Next.js には `metadataBase` という置き場所があり、ここで決めた住所を元に組み立てます。
 *
 * 住所の決め方は 3 段構え。**どれも無ければ localhost** に倒すので、手元で動かすときも困りません。
 *   1. `NEXT_PUBLIC_SITE_URL` … 自分で決めたいとき（設定していなくてよい）
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` … Vercel が本番に自動で入れる（例: tabikoe.vercel.app）
 *   3. `VERCEL_URL` … プレビュー（PR ごとの URL）
 *
 * **秘密ではありません**（公開されている住所そのもの）。
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return new URL(`https://${production}`);
  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return new URL(`https://${preview}`);
  return new URL("http://localhost:3000");
}
