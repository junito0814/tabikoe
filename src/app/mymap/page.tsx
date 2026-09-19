import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { MyMapScreen } from "@/components/map/MyMapScreen";
import { parseMyMapMode } from "@/lib/map/get-my-map-pins";

/**
 * SC-12 あしあと画面（v3.1 で「マイマップ」から改称）
 * 出典: docs/tasks/records/my-map/02-map-component-reuse-integration.md
 *
 * マイページ（SC-06）の遷移メニューから開く（4.2）。ログイン必須。
 */
export default async function MyMapPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const supabase = await createClient();
  await requireUserOrRedirect(supabase, "/mymap");
  const { mode } = await searchParams;
  return <MyMapScreen initialMode={parseMyMapMode(mode ?? null)} />;
}
