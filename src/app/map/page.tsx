import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { MapScreen } from "@/components/map/MapScreen";
import { resolveMapOpen } from "@/components/map/map-navigation";
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
  const open = resolveMapOpen(params);
  const flashKey = resolveFlashKey(params);
  const newBadgeTypes = parseBadgeToastParam(params.badges);

  return (
    <>
      {newBadgeTypes.length > 0 && <BadgeToast badgeTypes={newBadgeTypes} />}
      <MapScreen open={open} notice={flashKey ? <FlashNotice flashKey={flashKey} /> : undefined} />
    </>
  );
}
