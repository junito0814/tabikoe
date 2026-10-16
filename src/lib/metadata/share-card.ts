import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { countPublicSpotPosts } from "@/lib/spots/count-public-spot-posts";
import { averageRating } from "@/lib/map/spot-aggregate";
import { siteUrl } from "./site-url";

/**
 * #952（2026-10-17）: 共有した URL に出るリンクカード（OG）
 * 出典: Issue #952、要件定義書 4.5.18、ワイヤーフレーム決定事項 96
 *
 * 【初心者向け】LINE や X に URL を貼ると、写真と題名の付いた「カード」が出ます。
 * あれは、貼られた側のサーバーがその URL を取りに来て、HTML の `<meta property="og:...">`
 * を読んで作っています。いまは題名しか返していないので、**貼っても青い文字列のまま**でした。
 *
 * ## 画像は「期限つきの署名 URL」をそのまま入れる
 *
 * 写真の置き場（`post-media`）は**非公開のまま**にします。代わりに、**1 時間だけ有効な
 * 署名 URL**（画面に出すのと同じもの）を `og:image` に入れます。
 *
 * ばかげて見えるかもしれませんが、**Instagram も同じことをしています**
 * （`og:image` の中に `oh=`（署名）と `oe=`（期限）が入っている。2026-10-16 に実際の HTML で確認）。
 * LINE や X のクローラーは、ページを取った直後に画像を取りに来て**自分の側に保存する**ので、
 * 1 時間あれば足ります。バケットを公開にすると、**非公開投稿の写真まで URL だけで取れてしまいます**。
 *
 * **一度クローラーに渡った画像は、こちらから消せません。** 投稿者が後から非公開にしても、
 * 共有先に残ったカードの画像は残ります（Instagram も同じ性質です）。これは利用規約に書きます。
 *
 * ## 出さない場合
 *
 * **署名を発行するのは公開投稿のときだけ。** 非公開・下書き・非表示では画像を出さず、
 * 題名でも中身を明かしません（`page-title.ts` と同じ考え方 ── 「その ID は無い」と
 * 「あるが見られない」を言い分けない）。
 */

/** カードの題名は、どちらの画面も `〈スポット名〉｜タビコエ`（要件 4.5.18） */
export function shareCardTitle(spotName: string): string {
  return `${spotName}｜タビコエ`;
}

/** スポットのカードの説明（`行った人の投稿 12 件　★4.2`。評価が無ければ件数だけ） */
export function spotCardDescription(postCount: number, ratingAverage: number | null): string {
  const count = `行った人の投稿 ${postCount} 件`;
  return ratingAverage === null ? count : `${count}　★${ratingAverage.toFixed(1)}`;
}

/** OG と Twitter カードの共通部分（画像は 1 枚だけ。無ければ付けない） */
function cardMetadata(options: { title: string; description: string; path: string; imageUrl: string | null }): Metadata {
  const images = options.imageUrl ? [{ url: options.imageUrl }] : undefined;
  return {
    openGraph: {
      type: "article",
      siteName: "タビコエ",
      title: options.title,
      description: options.description,
      url: new URL(options.path, siteUrl()).toString(),
      images,
    },
    twitter: {
      // 大きい画像の形。画像が無いときも指定しておく（文字だけのカードになる）
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images,
    },
  };
}

/**
 * スポット別一覧（SC-04）のカード。
 *
 * 画像は**そのスポットのいちばん新しい公開投稿の 1 枚目**。一覧の先頭に出ている写真と同じものになります。
 */
export async function spotShareCard(spotId: string, spotName: string): Promise<Metadata> {
  const admin = createAdminClient();
  const [postCount, ratings, cover] = await Promise.all([
    countPublicSpotPosts(admin, spotId),
    admin.from("posts").select("rating").eq("spot_id", spotId).eq("visibility", "public").eq("status", "published").is("hidden_at", null),
    latestSpotCoverPath(spotId),
  ]);
  const imageUrl = cover ? ((await createPostPhotoUrls(admin, [cover])).get(cover) ?? null) : null;
  return cardMetadata({
    title: shareCardTitle(spotName),
    description: spotCardDescription(postCount, averageRating(((ratings.data ?? []) as { rating: number | null }[]).map((row) => row.rating))),
    path: `/spots/${spotId}`,
    imageUrl,
  });
}

/** そのスポットのいちばん新しい公開投稿の、1 枚目の写真の置き場所。無ければ null */
async function latestSpotCoverPath(spotId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("posts")
    .select("post_photos(storage_url, display_order, hidden_at)")
    .eq("spot_id", spotId)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const row of (data ?? []) as unknown as { post_photos: { storage_url: string | null; display_order: number; hidden_at: string | null }[] }[]) {
    const first = [...row.post_photos].sort((a, b) => a.display_order - b.display_order).find((photo) => photo.storage_url && !photo.hidden_at);
    if (first?.storage_url) return first.storage_url;
  }
  return null;
}

/**
 * 投稿詳細（SC-05）のカード。**公開投稿でなければ `null`**（呼ぶ側はカードを足さない）。
 *
 * 【初心者向け】`page-title.ts` の `postTitle` と同じ条件で引いています。タブ名が出ない投稿では
 * カードも出ない、と揃えておくと「片方からだけ中身が漏れる」ことがありません。
 */
export async function postShareCard(postId: string): Promise<Metadata | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("posts")
    .select("comment, spots(name), post_photos(storage_url, display_order, hidden_at)")
    .eq("id", postId)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("hidden_at", null)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as {
    comment: string | null;
    spots: { name: string } | { name: string }[] | null;
    post_photos: { storage_url: string | null; display_order: number; hidden_at: string | null }[];
  };
  const spot = Array.isArray(row.spots) ? row.spots[0] : row.spots;
  if (!spot) return null;

  const cover = [...row.post_photos].sort((a, b) => a.display_order - b.display_order).find((photo) => photo.storage_url && !photo.hidden_at);
  const imageUrl = cover?.storage_url ? ((await createPostPhotoUrls(admin, [cover.storage_url])).get(cover.storage_url) ?? null) : null;
  return cardMetadata({
    title: shareCardTitle(spot.name),
    description: postCardDescription(row.comment),
    path: `/posts/${postId}`,
    imageUrl,
  });
}

/** 投稿のカードの説明（感想の冒頭 1 行）。感想が無ければ空にせず、場所の話だと分かる言葉にする */
export function postCardDescription(comment: string | null): string {
  const line = (comment ?? "").split(/\r?\n/)[0]?.trim() ?? "";
  if (line.length === 0) return "行った人の投稿";
  // カードは 2 行ほどで切られるので、長すぎる感想はこちらで切っておく（途中で切れた印を付ける）
  return line.length > 90 ? `${line.slice(0, 90)}…` : line;
}
