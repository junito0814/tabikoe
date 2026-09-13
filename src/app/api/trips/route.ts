import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumList } from "@/lib/albums/get-album";

const MAX_SUGGESTIONS = 10;

/**
 * F-PO-01 旅行タイトル Task1: オートコンプリート候補取得
 * 出典: docs/tasks/posts/trip-title/01-trip-title-autocomplete-handler.md
 *
 * 本人が過去に作成した旅行タイトルを部分一致で返す。
 * F-RC-03: 本人が編集者・オーナーとして参加しているアルバムの旅行も候補に含める
 * （編集者はそのアルバムに自分の投稿を追加できる。3.6.3）。他人の旅行を読むため service_role で取り、
 * 対象は album_members の本人行に限定する。
 *
 * F-RC-02 Task1: `view=albums` を付けると、本人がメンバーのアルバム一覧（投稿1件以上）を返す。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const admin = createAdminClient();

  if (searchParams.get("view") === "albums") {
    try {
      const albums = await getAlbumList(admin, user.id);
      return NextResponse.json({ albums });
    } catch {
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }
  }

  const query = searchParams.get("query")?.trim() ?? "";

  let builder = admin
    .from("album_members")
    .select("role, trips!inner(id, title, created_at)")
    .eq("user_id", user.id)
    .in("role", ["owner", "editor"])
    .order("created_at", { referencedTable: "trips", ascending: false })
    .limit(MAX_SUGGESTIONS);

  if (query.length > 0) {
    // ilikeで大文字小文字を区別しない部分一致にする。
    // %と_はLIKEのワイルドカードなのでエスケープする
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
    builder = builder.ilike("trips.title", `%${escaped}%`);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const trips = (data ?? []).flatMap((row) => {
    const trip = (Array.isArray(row.trips) ? row.trips[0] : row.trips) as
      | { id: string; title: string }
      | null
      | undefined;
    return trip ? [{ id: trip.id, title: trip.title }] : [];
  });

  return NextResponse.json({ trips });
}
