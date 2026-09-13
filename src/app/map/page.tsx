import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { MapScreen } from "@/components/map/MapScreen";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { parseBadgeToastParam } from "@/components/badges/badge-toast-params";
import { FlashNotice, resolveFlashKey } from "@/components/notices/FlashNotice";
import { parseMapView } from "@/lib/map/get-map-pins";

/**
 * SC-02 マップ画面（全体マップ）
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md
 *
 * ログイン後の着地点（4.1）。ログイン必須（3.5.4）で、未ログインならログイン画面へ誘導し、
 * ログイン後にここへ戻す。
 * 投稿作成・更新・削除・ブロックの完了メッセージと、獲得バッジのトースト（F-BG Task5）は
 * トップページから引き継ぎ、ここで表示する。
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
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
  const flashKey = resolveFlashKey(params);
  const newBadgeTypes = parseBadgeToastParam(params.badges);

  return (
    <>
      {newBadgeTypes.length > 0 && <BadgeToast badgeTypes={newBadgeTypes} />}
      <MapScreen
        initialView={parseMapView(params.view ?? null)}
        notice={flashKey ? <FlashNotice flashKey={flashKey} /> : undefined}
      />
    </>
  );
}
