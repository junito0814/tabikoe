import { redirect } from "next/navigation";
import { legacyMyMapTarget } from "@/lib/map/legacy-my-map-url";

/**
 * #973: 古い URL（`/mymap`）から新しい URL（`/post-history`）へ転送するだけのページ。
 *
 * 【初心者向け】この画面の名前は「マイマップ」→「あしあと」→「**投稿履歴**」と 3 回変わり、
 * URL だけ初代のまま残っていました（#682 で「URL は変えない」と決めたため）。
 * 名前が揃っていないと、コードを読む側に「どれが同じものか」が分かりません（約束 10・11）。
 *
 * **消すのではなく転送を残すのは**、ブックマークと、`?back=%2Fmymap` を持ったままの
 * リンク（`sessionStorage` に残った戻り先など）が切れないようにするためです。
 * `/spots/[id]/photos` と同じやり方です。
 *
 * 一覧・地図の切り替え（`?view=map`）やピンの種類（`?mode=`）はそのまま引き継ぎます。
 */
export default async function LegacyMyMapPage({ searchParams }: PageProps<"/mymap">) {
  redirect(legacyMyMapTarget(await searchParams));
}
