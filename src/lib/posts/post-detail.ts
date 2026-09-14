import type { SupabaseClient } from "@supabase/supabase-js";
import { isBlockedEitherWay } from "@/lib/blocks/get-blocked-user-ids";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import { DEACTIVATED_DISPLAY_NAME, DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import type { MediaItem } from "@/components/media/MediaGrid";

/**
 * F-VW-01 Task1: 投稿詳細の取得と非公開アクセス制御
 * 出典: docs/tasks/browsing/post-detail-view/01-post-detail-handler.md
 *       要件定義書3.3.6・3.6.3・3.5.1
 */
export interface PostDetailData {
  id: string;
  spot: { id: string; name: string; prefecture: string | null };
  category: string;
  visitDate: string | null;
  duration: string | null;
  cost: number | null;
  rating: number | null;
  comment: string | null;
  visibility: "public" | "private";
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string; isDeleted: boolean };
  media: MediaItem[];
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  isWishlisted: boolean;
  isOwner: boolean;
  /** いいね・コメントを付けられるか（公開投稿のみ。3.3.6） */
  canInteract: boolean;
}

/**
 * 閲覧可否（純粋関数、単体テストの対象）。
 * 公開投稿は誰でも、非公開投稿は投稿者本人か、その投稿が属する旅行のアルバムメンバーのみ。
 */
export function canViewPost(
  post: { user_id: string; visibility: string },
  viewerId: string,
  isAlbumMember: boolean
): boolean {
  if (post.visibility === "public") return true;
  return post.user_id === viewerId || isAlbumMember;
}

/** 退会済みユーザーの投稿者表示を匿名化する（F-AC-05）。純粋関数、単体テストの対象 */
export function presentAuthor(user: {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_deleted: boolean;
}): PostDetailData["author"] {
  if (user.is_deleted) {
    return { id: user.id, displayName: DEACTIVATED_DISPLAY_NAME, avatarUrl: DEFAULT_AVATAR_URL, isDeleted: true };
  }
  return {
    id: user.id,
    displayName: user.display_name ?? "ユーザー",
    avatarUrl: user.avatar_url ?? DEFAULT_AVATAR_URL,
    isDeleted: false,
  };
}

export interface PostDetailRow {
  id: string;
  user_id: string;
  trip_id: string;
  spot_id: string;
  category: string;
  visit_date: string | null;
  duration: string | null;
  cost: number | null;
  rating: number | null;
  comment: string | null;
  visibility: string;
  created_at: string;
  hidden_at?: string | null;
  review_hidden_at?: string | null;
  spots: { id: string; name: string; prefecture: string | null } | { id: string; name: string; prefecture: string | null }[] | null;
  users:
    | { id: string; display_name: string | null; avatar_url: string | null; is_deleted: boolean }
    | { id: string; display_name: string | null; avatar_url: string | null; is_deleted: boolean }[]
    | null;
  post_photos: {
    id: string;
    storage_url: string | null;
    video_url: string | null;
    media_type: string;
    display_order: number;
    hidden_at?: string | null;
  }[];
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * 投稿詳細を組み立てる。閲覧できない・存在しない・ブロック関係のいずれも null（呼び出し側は404）。
 * 他人の投稿を読むため service_role で取り、可視性はここで判定する（RLS も同じ条件、20260914000001）。
 */
export async function getPostDetail(
  admin: SupabaseClient,
  viewerId: string,
  postId: string
): Promise<PostDetailData | null> {
  const { data, error } = await admin
    .from("posts")
    .select(
      "id, user_id, trip_id, spot_id, category, visit_date, duration, cost, rating, comment, visibility, created_at, hidden_at, review_hidden_at, " +
        "spots(id, name, prefecture), users(id, display_name, avatar_url, is_deleted), " +
        "post_photos(id, storage_url, video_url, media_type, display_order, hidden_at)"
    )
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PostDetailRow;
  const isOwner = row.user_id === viewerId;

  // F-AD-05: 通報対応で非公開化された投稿は本人以外に見せない（存在しない扱い）
  if (row.hidden_at && !isOwner) return null;

  if (!isOwner) {
    // 3.8.2 相互非表示。存在自体を伏せる
    if (await isBlockedEitherWay(admin, viewerId, row.user_id)) return null;
  }

  let isAlbumMember = false;
  if (!isOwner && row.visibility !== "public") {
    const { data: membership } = await admin
      .from("album_members")
      .select("id")
      .eq("trip_id", row.trip_id)
      .eq("user_id", viewerId)
      .maybeSingle();
    isAlbumMember = membership !== null;
  }
  if (!canViewPost(row, viewerId, isAlbumMember)) return null;

  const [signedUrls, likeCount, commentCount, viewerLike, wishlist] = await Promise.all([
    // 動画本体（video_url）も同じ非公開バケットにあるため、サムネイルと合わせて署名する
    createPostPhotoUrls(
      admin,
      row.post_photos.flatMap((photo) =>
        [photo.storage_url, photo.video_url].filter((path): path is string => Boolean(path))
      )
    ),
    admin.from("likes").select("id", { count: "exact", head: true }).eq("post_id", row.id),
    admin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", row.id),
    admin.from("likes").select("id").eq("post_id", row.id).eq("user_id", viewerId).maybeSingle(),
    admin.from("wishlist").select("id").eq("user_id", viewerId).eq("spot_id", row.spot_id).maybeSingle(),
  ]);

  const spot = one(row.spots);
  const user = one(row.users);
  const media: MediaItem[] = [...row.post_photos]
    .filter((photo) => !photo.hidden_at || isOwner)
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((photo, index) => {
      const url = photo.storage_url ? signedUrls.get(photo.storage_url) : undefined;
      if (!url) return [];
      const isVideo = photo.media_type === "video";
      return [
        {
          id: photo.id,
          mediaType: isVideo ? ("video" as const) : ("photo" as const),
          thumbnailUrl: url,
          alt: `${spot?.name ?? "スポット"}の${isVideo ? "動画" : "写真"} ${index + 1}`,
          videoUrl: isVideo && photo.video_url ? signedUrls.get(photo.video_url) : undefined,
        },
      ];
    });

  return {
    id: row.id,
    spot: { id: spot?.id ?? row.spot_id, name: spot?.name ?? "", prefecture: spot?.prefecture ?? null },
    category: row.category,
    visitDate: row.visit_date,
    duration: row.duration,
    cost: row.cost,
    rating: row.rating,
    // 感想テキストだけが非公開化された場合も本人以外には伏せる
    comment: row.review_hidden_at && !isOwner ? null : row.comment,
    visibility: row.visibility === "private" ? "private" : "public",
    createdAt: row.created_at,
    author: presentAuthor(
      user ?? { id: row.user_id, display_name: null, avatar_url: null, is_deleted: false }
    ),
    media,
    likeCount: likeCount.count ?? 0,
    commentCount: commentCount.count ?? 0,
    viewerHasLiked: viewerLike.data !== null,
    isWishlisted: wishlist.data !== null,
    isOwner,
    canInteract: row.visibility === "public",
  };
}
