/**
 * #951（2026-10-17）: 未ログインで読んでよい問い合わせかどうか
 * 出典: Issue #951、要件定義書 3.5.4「公開範囲」
 *
 * 【初心者向け】共有リンクで開けるのは **1 つのスポットの投稿（SC-04。その「写真」タブを含む）**
 * と **投稿詳細（SC-05）** だけです。都道府県や駅での検索結果はログインが要ります。
 *
 * `/api/posts/search` と `/api/posts/photos` は**同じクエリ**を受けるので、
 * 判定も 1 つにしておきます（片方だけ直すとズレるため。約束 14）。
 */
export function isGuestReadableSearch(searchParams: URLSearchParams): boolean {
  const spot = searchParams.get("spot");
  return typeof spot === "string" && spot !== "";
}
