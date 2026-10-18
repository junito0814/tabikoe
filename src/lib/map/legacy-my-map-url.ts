/**
 * #973: 古い URL（`/mymap`）から新しい URL（`/post-history`）への行き先を決める。
 *
 * 【初心者向け】判断（どのクエリを引き継ぐか）だけを**純粋関数**に切り出しています。
 * 画面やサーバーの作りが変わっても、ここだけテストすれば済むようにするためです（約束 13）。
 *
 * 引き継ぐのは `view`（一覧／地図の切り替え）と `mode`（出すピンの種類）の 2 つだけ。
 * 知らないクエリは落とします ── 古い URL に何が付いていても、新しい画面が解釈できるものに限ります。
 */
const CARRIED = ["view", "mode"] as const;

export function legacyMyMapTarget(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const key of CARRIED) {
    const value = query[key];
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/post-history?${search}` : "/post-history";
}
