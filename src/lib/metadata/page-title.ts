import { createAdminClient } from "@/lib/supabase/admin";

/**
 * #785（2026-10-06）: 画面ごとのタブ名のうち、**中身で決まるもの**
 * 出典: Issue #785「ブラウザのタブ名を画面ごとに付ける」
 *
 * 【初心者向け】スポット別一覧は「大阪城」、投稿詳細は「大阪城の投稿」のように、
 * **開くまで分からない名前**をタブに出します。`generateMetadata` から呼ばれます。
 *
 * **見つからないときは名前を出しません。** 「その ID は無い」と「その ID はあるが
 * 見られない」を言い分けると、**そこに何かが在ることが分かってしまいます**
 * （他人の下書きの URL を順に試せる）。どちらも `null` を返し、
 * 呼び出し側は既定の「タビコエ」に倒します（#765 の 404 と同じ考え方）。
 *
 * 名前を引くだけなので、1 列だけ取る軽い問い合わせにしています。
 */

/** スポット名。無ければ null */
export async function spotTitle(spotId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("spots").select("name").eq("id", spotId).is("hidden_at", null).maybeSingle();
  return data?.name ?? null;
}

/** 投稿の「〈スポット名〉の投稿」。公開されていない投稿は null */
export async function postTitle(postId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("posts")
    .select("spots(name)")
    .eq("id", postId)
    .eq("status", "published")
    .is("hidden_at", null)
    .maybeSingle();
  const name = (data?.spots as unknown as { name: string } | null)?.name;
  return name ? `${name}の投稿` : null;
}

/** 旅行（アルバムとしおりで共通の題名）。無ければ null */
export async function tripTitle(tripId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("trips").select("title").eq("id", tripId).is("hidden_at", null).maybeSingle();
  return data?.title ?? null;
}

/** しおりの題名（旅行の題名と同じ）。無ければ null */
export async function itineraryTitle(itineraryId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("itineraries").select("trips(title)").eq("id", itineraryId).maybeSingle();
  return (data?.trips as unknown as { title: string } | null)?.title ?? null;
}

/** 利用者の表示名。退会済み・見つからないときは null */
export async function userTitle(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("users").select("display_name, is_deleted").eq("id", userId).maybeSingle();
  return data && !data.is_deleted ? (data.display_name ?? null) : null;
}

/**
 * 検索結果（/search）のタブ名。
 *
 * 【初心者向け】ここだけは URL の条件から決めます。画面の中身を出すときに使う
 * `resolveDestination` は**地名を座標に直す問い合わせ**（Geocoding）をするので、
 * タブ名のためにもう一度呼ぶと、同じ問い合わせを 2 回することになります。
 * 都道府県と地名は URL にそのまま入っているので、引き直す必要がありません。
 */
export async function searchPageTitle(params: { spot?: string; pref?: string; q?: string }): Promise<string | null> {
  const spotId = params.spot?.trim();
  if (spotId) return spotTitle(spotId);
  const pref = params.pref?.trim();
  if (pref) return `${pref}の投稿`;
  const q = params.q?.trim();
  if (q) return `${q}の投稿`;
  // 条件なし＝全部（#825 で「みんなの投稿」に決めた見出しと同じ言葉）
  return "みんなの投稿";
}
