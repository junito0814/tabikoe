import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ItineraryDetailScreen } from "@/components/itineraries/ItineraryDetailScreen";
import { getItinerary, type ItineraryDetail } from "@/lib/itineraries/get-itinerary";

/**
 * SC-23 しおり詳細
 * 出典: docs/tasks/itinerary/itinerary-basics/03-itinerary-detail-skeleton.md
 *
 * 【初心者向け】メンバーでなければ 404（存在も知らせない。3.11.7）。
 * `?day=<n>&spot=<id>` は地図の番号ピンから来たとき（その Day を開き、該当行を強調）。
 */
export default async function ItineraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string; spot?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/itineraries/${id}`);

  let itinerary: ItineraryDetail | null = null;
  try {
    itinerary = await getItinerary(createAdminClient(), id, user.id);
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }
  if (!itinerary) notFound();

  const query = await searchParams;
  const dayNumber = query.day === undefined ? undefined : query.day === "undecided" ? null : Number.parseInt(query.day, 10);
  const initialDay = dayNumber === undefined ? undefined : dayNumber === null || !Number.isInteger(dayNumber) ? null : dayNumber;

  return <ItineraryDetailScreen initial={itinerary} viewerId={user.id} initialDay={initialDay} highlightSpotId={query.spot ?? null} />;
}
