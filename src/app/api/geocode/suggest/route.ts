import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { suggestDestinations } from "@/lib/search/suggest-destinations";

/**
 * GET /api/geocode/suggest?q=&session= — 行き先候補（search-top Task1）
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const session = params.get("session");
  try {
    const result = await suggestDestinations(createAdminClient(), q, { sessionToken: session });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "suggest_failed" }, { status: 500 });
  }
}
