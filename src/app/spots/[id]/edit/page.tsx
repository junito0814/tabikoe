import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { SpotFixScreen } from "@/components/spots/SpotFixScreen";
import { loadSpotFixTarget } from "@/lib/moderation/spot-fix";

export const dynamic = "force-dynamic";

/**
 * strike-system Task 6: スポットの修正（SC-29）
 * 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
 *
 * 本人が登録した「タビコエだけの場所」だけ開ける（それ以外は 404）。管理者の依頼の内容は操作の記録から引く
 */
export default async function SpotEditPage({ params }: PageProps<"/spots/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/spots/${id}/edit`);
  const admin = createAdminClient();
  const spot = await loadSpotFixTarget(admin, id).catch(() => null);
  if (!spot || spot.source !== "manual" || spot.createdBy !== user.id) notFound();

  const { data: request } = await admin
    .from("admin_actions")
    .select("note")
    .eq("action", "spot_fix_request")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <SpotFixScreen spot={{ id: spot.id, name: spot.name, prefecture: spot.prefecture, lat: spot.lat, lng: spot.lng }} requestNote={(request?.note as string | null) ?? null} />;
}
