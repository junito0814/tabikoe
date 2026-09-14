import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import PostForm, { type PostFormInitialValues } from "@/components/posts/PostForm";
import type { PostCategory, PostDuration, PostVisibility } from "@/lib/posts/constants";

/**
 * SC-03 投稿編集画面（編集モード）
 * 出典: docs/tasks/posts/post-edit/03-post-edit-ui.md
 *
 * 投稿者本人以外は編集画面へ入れない（3.3.3。共同アルバムのオーナーであっても同様）。
 * 他人の投稿・存在しない投稿はいずれも404として扱い、編集モードへの遷移自体をブロックする。
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/posts/${id}/edit`);

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select(
      "id, user_id, category, visit_date, duration, cost, rating, comment, visibility, trips(title), spots(id, name, lat, lng, prefecture, source)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!post || post.user_id !== user.id) {
    notFound();
  }

  const { data: photos } = await admin
    .from("post_photos")
    .select("id, storage_url, media_type")
    .eq("post_id", id)
    .order("display_order", { ascending: true });

  // post-mediaは非公開バケットのため、表示には署名付きURLが要る
  const signedUrls = await createPostPhotoUrls(
    admin,
    (photos ?? []).map((photo) => photo.storage_url)
  );

  const trip = Array.isArray(post.trips) ? post.trips[0] : post.trips;
  const spot = Array.isArray(post.spots) ? post.spots[0] : post.spots;

  if (!spot) {
    notFound();
  }

  const initialPost: PostFormInitialValues = {
    postId: post.id,
    tripTitle: trip?.title ?? "",
    spot: {
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      prefecture: spot.prefecture,
      source: spot.source,
    },
    category: post.category as PostCategory,
    visitDate: post.visit_date ?? "",
    duration: post.duration as PostDuration,
    cost: post.cost === null ? "" : String(post.cost),
    rating: post.rating,
    comment: post.comment ?? "",
    visibility: post.visibility as PostVisibility,
    photos: (photos ?? []).flatMap((photo) => {
      const url = signedUrls.get(photo.storage_url);
      return url
        ? [{ id: photo.id, url, mediaType: photo.media_type === "video" ? ("video" as const) : ("photo" as const) }]
        : [];
    }),
  };

  return <PostForm initialPost={initialPost} />;
}
