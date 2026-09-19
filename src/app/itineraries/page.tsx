import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ItineraryListScreen } from "@/components/itineraries/ItineraryListScreen";
import { listItineraries } from "@/lib/itineraries/get-itinerary";
import { todayInJst } from "@/lib/posts/constants";

/**
 * SC-22 しおり一覧
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md
 *
 * 【初心者向け】ログイン必須。自分がメンバーのしおりをサーバーで取り、並び順は画面側（sort-itineraries.ts）で決める。
 */
export default async function ItinerariesPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/itineraries");
  let items: Awaited<ReturnType<typeof listItineraries>> | null = null;
  let wishlistCount: number | null = null;
  try {
    const admin = createAdminClient();
    const [list, wishlist] = await Promise.all([
      listItineraries(admin, user.id),
      // v3.1（mentoring-7 Task9）: 先頭の「行きたいスポット」の件数。取れなくても一覧は出す
      admin.from("wishlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    items = list;
    wishlistCount = wishlist.count ?? null;
  } catch {
    items = null;
  }
  if (items === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }
  return <ItineraryListScreen items={items} today={todayInJst()} wishlistCount={wishlistCount} />;
}
