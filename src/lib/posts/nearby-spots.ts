import type { TravelMode } from "@/lib/geo/travel-time";
import type { NearbyPost } from "./nearby-posts";

/**
 * #769（2026-10-06）: 「近くのスポット」のカードをスポット単位にまとめる
 * 出典: Issue #769「「近くのスポット」のカードをスポット単位にする」
 *
 * 【初心者向け】見出しは「近くのスポット」なのに、中身は**投稿単位**でした。
 * 浅草寺に 3 件の投稿があれば**浅草寺のカードが 3 枚**並びます。
 * 同じ場所が何度も出てきて、近い場所をいくつ回れるのかも分かりません。
 *
 * 検索結果（`aggregateSpotCards`）と同じ考え方で、スポットごとに 1 枚へまとめます。
 * 1 枚に **★の平均・投稿件数・最新の感想・いちばん近い所要時間**。
 *
 * 判断（まとめ方）はこの純粋関数だけに置き、画面はその結果を並べるだけです（約束 13）。
 */
export interface NearbySpot {
  /** 地図のピンと結びつける鍵（`activeNearbySpotId`）。今までと同じ */
  spotId: string;
  spotName: string;
  lat: number;
  lng: number;
  /** この半径の中で見つかった、このスポットの公開投稿の件数 */
  postCount: number;
  /** ★の平均（小数 1 桁）。評価の無い投稿は数えない。1 つも無ければ null */
  averageRating: number | null;
  /** いちばん新しい投稿の感想の冒頭 */
  latestComment: string | null;
  thumbnailUrl: string | null;
  distanceMeters: number;
  /** 徒歩の分（v3.0 からの互換） */
  walkMinutes: number;
  /** 選んだ移動手段での所要時間の目安（分） */
  minutes: number;
  mode: TravelMode;
}

/** まとめる前の 1 件（投稿）。`selectNearbyPosts` の戻り値に評価を足したもの */
export type NearbyPostForGrouping = Omit<NearbyPost, "thumbnailUrl"> & { thumbnailPath: string | null; rating: number | null };

/**
 * 投稿の並び（**新しい順に渡す前提**）をスポットごとにまとめる。
 *
 * 【初心者向け】「いちばん新しい感想」を素直に取れるよう、呼ぶ側が新しい順で渡します。
 * 距離は**いちばん近いもの**を採ります（同じスポットなら距離は同じですが、念のため小さい方）。
 * 返す並びは**近い順**（カードは近い順に出す）。
 */
export function aggregateNearbySpots(posts: readonly NearbyPostForGrouping[], limit: number): (Omit<NearbySpot, "thumbnailUrl"> & { thumbnailPath: string | null })[] {
  const bySpot = new Map<string, Omit<NearbySpot, "thumbnailUrl"> & { thumbnailPath: string | null; ratingSum: number; ratingCount: number }>();
  for (const post of posts) {
    let spot = bySpot.get(post.spotId);
    if (!spot) {
      spot = {
        spotId: post.spotId,
        spotName: post.spotName,
        lat: post.lat,
        lng: post.lng,
        postCount: 0,
        averageRating: null,
        latestComment: post.commentExcerpt,
        thumbnailPath: post.thumbnailPath,
        distanceMeters: post.distanceMeters,
        walkMinutes: post.walkMinutes,
        minutes: post.minutes,
        mode: post.mode,
        ratingSum: 0,
        ratingCount: 0,
      };
      bySpot.set(post.spotId, spot);
    }
    spot.postCount += 1;
    if (typeof post.rating === "number") {
      spot.ratingSum += post.rating;
      spot.ratingCount += 1;
    }
    // 先頭が最新なので、感想と写真は「まだ無ければ後ろの投稿から補う」
    if (spot.latestComment === null) spot.latestComment = post.commentExcerpt;
    if (spot.thumbnailPath === null) spot.thumbnailPath = post.thumbnailPath;
    if (post.distanceMeters < spot.distanceMeters) {
      spot.distanceMeters = post.distanceMeters;
      spot.walkMinutes = post.walkMinutes;
      spot.minutes = post.minutes;
    }
  }
  return Array.from(bySpot.values())
    .map(({ ratingSum, ratingCount, ...spot }) => ({
      ...spot,
      averageRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
