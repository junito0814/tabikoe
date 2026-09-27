import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { buildComposeInitialState, type ComposeQuery } from "@/lib/posts/compose-initial-state";
import { loadExistingPostForCompose, loadSpotForCompose, loadItineraryForCompose } from "@/lib/posts/load-compose-data";
import { PostComposeScreen } from "@/components/posts/PostComposeScreen";
import { getPostingRestrictionUntil } from "@/lib/moderation/posting-restriction";

/**
 * SC-03 投稿画面（新規作成・下書きの続き）
 * 出典: docs/tasks/posts/post-creation-v3/03-split-screen-layout.md
 *       docs/tasks/posts/post-entry-points/01-compose-initial-state.md
 *
 * 【初心者向け】Server Component。URL のクエリ（?lat&lng / ?spot= / ?itinerary= / ?draft=）を読み、
 * 必要なものをサーバーで DB から引いてから、画面（PostComposeScreen、クライアント）に初期値として渡す。
 * 投稿作成はログイン必須（要件定義書3.3.1）。
 */
export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const query: ComposeQuery = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === "string" ? value : null])
  );
  const currentPath = `/posts/new${Object.keys(params).length ? `?${new URLSearchParams(query as Record<string, string>).toString()}` : ""}`;
  const user = await requireUserOrRedirect(supabase, currentPath);
  const admin = createAdminClient();
  // strike-system Task 2: 投稿禁止中なら画面で理由と解除日を出す（最終判定は API 側）
  const restrictedUntilPromise = getPostingRestrictionUntil(admin, user.id);

  // 下書きの続き: 本人の下書きだけを開ける
  if (query.draft) {
    const [existing, postingRestrictedUntil] = await Promise.all([loadExistingPostForCompose(admin, query.draft, user.id), restrictedUntilPromise]);
    if (!existing || existing.status !== "draft") notFound();
    return <PostComposeScreen initial={buildComposeInitialState(query)} existing={existing} postingRestrictedUntil={postingRestrictedUntil} />;
  }

  const [spot, itinerary, postingRestrictedUntil] = await Promise.all([
    query.spot ? loadSpotForCompose(admin, query.spot) : Promise.resolve(null),
    query.itinerary ? loadItineraryForCompose(admin, query.itinerary, user.id, query.day) : Promise.resolve(null),
    restrictedUntilPromise,
  ]);
  const initial = buildComposeInitialState(query, { spot, itinerary });
  return <PostComposeScreen initial={initial} postingRestrictedUntil={postingRestrictedUntil} />;
}
