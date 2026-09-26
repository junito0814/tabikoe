import { POST_CATEGORIES, type PostCategory } from "@/lib/posts/constants";

/**
 * pin-categories Task2（2026-09-26）: スポットのカテゴリを決める
 * 出典: docs/tasks/shared-ui/pin-categories/02-spot-category-resolution.md
 *       要件定義書 4.5.3「スポットのカテゴリの決め方」
 *
 * 【初心者向け】タビコエのカテゴリは「投稿」に付くもので、「スポット」には付いていない。
 * そのため 1 つのスポットに「グルメ」の投稿と「観光スポット」の投稿が混ざる
 * （Google マップのカテゴリは場所そのものの属性なので、この問題が起きない）。
 * 地図のピンは 1 色しか塗れないので、ここで 1 つに決める。
 *
 *   - そのスポットの公開投稿で**いちばん多いカテゴリ**
 *   - **同数なら新しい方**（最後に投稿された方）
 *   - 公開投稿が 1 件も無ければ null（ピンは灰色になる）
 *
 * 判断をこの関数だけに閉じ込めておくと、地図やデータの取り方が変わってもここだけテストすれば済む。
 */
export interface SpotCategoryInput {
  category: string | null;
  /** 投稿日時（ISO 文字列）。同数のときの決着に使う */
  createdAt: string | null;
}

export function resolveSpotCategory(posts: readonly SpotCategoryInput[]): PostCategory | null {
  const counts = new Map<PostCategory, { count: number; latest: number }>();

  for (const post of posts) {
    if (!isPostCategory(post.category)) continue;
    const at = post.createdAt ? Date.parse(post.createdAt) : NaN;
    const current = counts.get(post.category) ?? { count: 0, latest: Number.NEGATIVE_INFINITY };
    counts.set(post.category, {
      count: current.count + 1,
      latest: Number.isNaN(at) ? current.latest : Math.max(current.latest, at),
    });
  }

  let best: { category: PostCategory; count: number; latest: number } | null = null;
  for (const [category, value] of counts) {
    if (!best || value.count > best.count || (value.count === best.count && value.latest > best.latest)) {
      best = { category, count: value.count, latest: value.latest };
    }
  }
  return best?.category ?? null;
}

function isPostCategory(value: string | null): value is PostCategory {
  return value !== null && (POST_CATEGORIES as readonly string[]).includes(value);
}
