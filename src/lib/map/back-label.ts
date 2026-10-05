/**
 * mentoring-7 Task6（v3.1）: 地図（SC-02）の左上の「戻る」に出す戻り先の画面名
 * 出典: docs/tasks/shared-ui/mentoring-7/06-map-callout-and-back.md
 *       要件定義書 v3.1 3.4.3「置く要素」（「一覧に戻る」という文言は使わない）
 *
 * 【初心者向け】`?back=` に入っている「戻り先の URL」を見て、そこが何の画面かを言葉にする。純粋関数なので単体テストしやすい。
 *   /search?pref=大阪府     → 大阪府
 *   /search?q=大阪駅&lat&lng → 大阪駅
 *   /search?spot=<id>・/spots/<id>・/posts/<id> → スポット名（URL からは分からないのでサーバーが引いて渡す。取れなければ「一覧」）
 *   /itineraries/<id>       → しおり
 *   それ以外・無し          → ホーム
 * Bug #471（全画面で直前の画面に戻る）で足したもの:
 *   /mypage → マイページ、/wishlist → 行きたい、/albums → アルバム一覧、/albums/<id> → アルバム、/albums/<id>/photos → 写真、
 *   /itineraries → しおり一覧、/notifications → 通知、/mymap → あしあと、/map → 地図、/mypage/drafts → 下書き、/badges → バッジ
 */
export type BackTarget =
  | { kind: "home" }
  | { kind: "prefecture"; name: string }
  | { kind: "place"; name: string }
  | { kind: "spot"; spotId: string }
  | { kind: "post"; postId: string }
  | { kind: "itinerary" }
  | { kind: "list" }
  | { kind: "named"; label: string };

/** パスの先頭で決まる画面名（Bug #471）。順序は長い方から（/albums/<id>/photos を /albums より先に） */
const NAMED_PATHS: [RegExp, string][] = [
  [/^\/albums\/[^/]+\/photos\/?$/, "写真"],
  [/^\/albums\/[^/]+\/?$/, "アルバム"],
  [/^\/albums\/?$/, "アルバム一覧"],
  // #693: 画面名を「計画」に改めた（決定事項 75）
  [/^\/itineraries\/?$/, "計画"],
  [/^\/mypage\/drafts\/?$/, "下書き"],
  [/^\/mypage\/?$/, "マイページ"],
  [/^\/wishlist\/?$/, "行きたい"],
  [/^\/notifications\/?$/, "通知"],
  [/^\/mymap\/?$/, "投稿履歴"],
  [/^\/badges\/?$/, "バッジ"],
  [/^\/map\/?$/, "地図"],
];

export function classifyBackHref(back: string | null | undefined): BackTarget {
  if (!back) return { kind: "home" };
  let url: URL;
  try {
    url = new URL(back, "https://tabikoe.local");
  } catch {
    return { kind: "home" };
  }
  const path = url.pathname;
  const params = url.searchParams;
  if (path === "/" || path === "") return { kind: "home" };
  for (const [pattern, label] of NAMED_PATHS) {
    if (pattern.test(path)) return { kind: "named", label };
  }
  if (path.startsWith("/itineraries/")) return { kind: "itinerary" };
  const spotMatch = path.match(/^\/spots\/([^/]+)/);
  if (spotMatch) return { kind: "spot", spotId: spotMatch[1] };
  const postMatch = path.match(/^\/posts\/([^/]+)/);
  if (postMatch) return { kind: "post", postId: postMatch[1] };
  if (path === "/search") {
    if (params.get("spot")) return { kind: "spot", spotId: params.get("spot") as string };
    if (params.get("pref")) return { kind: "prefecture", name: params.get("pref") as string };
    if (params.get("q")) return { kind: "place", name: params.get("q") as string };
    return { kind: "list" };
  }
  return { kind: "list" };
}

/** 戻り先の画面名。スポット名は `spotName` で渡す（無ければスポット別は「一覧」、投稿詳細は「投稿」） */
export function backLabelFor(target: BackTarget, spotName: string | null = null): string {
  switch (target.kind) {
    case "home":
      return "ホーム";
    case "prefecture":
    case "place":
      return target.name;
    case "itinerary":
      return "しおり";
    case "spot":
      return spotName ?? "一覧";
    case "post":
      return spotName ?? "投稿";
    case "list":
      return "一覧";
    case "named":
      return target.label;
  }
}
