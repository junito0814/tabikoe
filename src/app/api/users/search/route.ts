import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { normalizeUserQuery, searchUsersByName } from "@/lib/users/search-users";

/**
 * feedback-0919 Task6（v3.2）: GET /api/users/search?q=<表示名の一部>
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
 *       要件定義書 v3.2 3.6.3（2 文字以上・最大 20 件）、7.3（1 分 30 回）
 *
 * 【初心者向け】アプリ内招待の相手をユーザー名で探す。自分・退会済み・ブロック関係は出さない。
 * 2 文字未満は空で返す（DB を叩かない）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = normalizeUserQuery(new URL(request.url).searchParams.get("q"));
  if (!query) return NextResponse.json({ users: [] });

  const admin = createAdminClient();
  const limit = RATE_LIMIT_ACTIONS.userSearch;
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(admin, user.id, limit.actionType, limit.windowSeconds, limit.limit);
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    return NextResponse.json({ users: await searchUsersByName(admin, user.id, query) });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
