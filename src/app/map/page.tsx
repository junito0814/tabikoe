import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { MapScreen } from "@/components/map/MapScreen";
import { resolveMapOpen } from "@/components/map/map-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyBackHref } from "@/lib/map/back-label";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { parseBadgeToastParam } from "@/components/badges/badge-toast-params";
import { FlashNotice, resolveFlashKey } from "@/components/notices/FlashNotice";

/**
 * SC-02 地図
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md
 *       docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *
 * 【初心者向け】v3.0 の着地点はホーム（/）で、地図は「近くのスポットを探す」「地図で見る」から開く。
 *   /map?mode=explore&lat&lng（探すモード）／ /map?spot=<id>&lat&lng&back=（スポット中心）／ /map（通常）
 * 探すモードは現在地が必須。位置情報が無い（lat/lng が付いていない）ときは検索トップへ戻す（3.4.5）。
 * 投稿作成・更新・削除・ブロックの完了メッセージと、獲得バッジのトースト（F-BG Task5）はここで表示する。
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    spot?: string;
    lat?: string;
    lng?: string;
    back?: string;
    itinerary?: string;
    day?: string;
    travel?: string;
    posted?: string;
    updated?: string;
    deleted?: string;
    blocked?: string;
    badges?: string;
  }>;
}) {
  const supabase = await createClient();
  await requireUserOrRedirect(supabase, "/map");

  const params = await searchParams;
  if (params.mode === "explore" && (params.lat === undefined || params.lng === undefined)) {
    redirect("/");
  }
  // v3.1（mentoring-7 Task6）: 戻り先がスポット別・投稿詳細ならスポット名を引いて「← たこ焼き〇〇」にする
  const open = resolveMapOpen({ ...params, backSpotName: await lookupBackSpotName(params.back) });
  const flashKey = resolveFlashKey(params);
  const newBadgeTypes = parseBadgeToastParam(params.badges);

  return (
    <>
      {newBadgeTypes.length > 0 && <BadgeToast badgeTypes={newBadgeTypes} />}
      <MapScreen open={open} notice={flashKey ? <FlashNotice flashKey={flashKey} /> : undefined} />
    </>
  );
}

/** back の URL がスポット別（/spots/[id]・/search?spot=）か投稿詳細（/posts/[id]）ならスポット名を返す。取れなければ null */
async function lookupBackSpotName(back: string | undefined): Promise<string | null> {
  const target = classifyBackHref(back);
  if (target.kind !== "spot" && target.kind !== "post") return null;
  try {
    const admin = createAdminClient();
    if (target.kind === "spot") {
      const { data } = await admin.from("spots").select("name").eq("id", target.spotId).maybeSingle();
      return data?.name ?? null;
    }
    const { data } = await admin.from("posts").select("spots(name)").eq("id", target.postId).maybeSingle();
    const spot = (data as { spots: { name: string } | { name: string }[] | null } | null)?.spots;
    return (Array.isArray(spot) ? spot[0] : spot)?.name ?? null;
  } catch {
    return null;
  }
}
