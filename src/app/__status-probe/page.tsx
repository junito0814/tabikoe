import { notFound } from "next/navigation";

/**
 * #964 の調査用（この PR では消す）。
 *
 * 【初心者向け】ストリーミングが始まったあとは HTTP のステータスを変えられない
 * （node_modules/next/dist/docs/.../loading.md の「Status Codes」）。
 * では `generateMetadata` の中で `notFound()` を呼べば、まだ本文を流していないので
 * 404 を返せるのか ── それを本番ビルドで確かめるためだけのページ。
 * 隣に loading.tsx を置き、本物の画面と同じ「流し始める境目」を作ってある。
 */
export async function generateMetadata() {
  notFound();
}

export default async function StatusProbePage() {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return <p>probe</p>;
}
