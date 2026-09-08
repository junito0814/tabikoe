import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

const MAX_SUGGESTIONS = 10;

/**
 * F-PO-01 旅行タイトル Task1: オートコンプリート候補取得
 * 出典: docs/tasks/posts/trip-title/01-trip-title-autocomplete-handler.md
 *
 * 本人が過去に作成した旅行タイトルのみを部分一致で返す。
 * 「本人のみ」はRLS（trips_owner_all）とuser_id条件の二重で担保する。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";

  let builder = supabase
    .from("trips")
    .select("id, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_SUGGESTIONS);

  if (query.length > 0) {
    // ilikeで大文字小文字を区別しない部分一致にする。
    // %と_はLIKEのワイルドカードなのでエスケープする
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
    builder = builder.ilike("title", `%${escaped}%`);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ trips: data ?? [] });
}
