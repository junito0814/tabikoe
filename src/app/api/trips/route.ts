import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumList, type AlbumSort } from "@/lib/albums/get-album";
import {
  TripTitleValidationError,
  assertValidTripTitle,
  normalizeTripTitle,
  resolveTripId,
} from "@/lib/trips/resolve-trip";

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
 *
 * trip-title-v3 Task1（v3.0）: 本人がメンバーの**しおり**の旅行も候補に含め、由来（own / album / itinerary）の
 * ラベルを付ける。しおりのメンバーはその旅行に投稿するとしおりのスポットが自動チェックされる（3.11.5）。
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
      // #715: 並び順（新着順／古い順）。おかしな値は既定の新着順にする
      const sort: AlbumSort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
      const albums = await getAlbumList(admin, user.id, sort);
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

  type Suggestion = { id: string; title: string; source: "own" | "album" | "itinerary" };
  const trips: Suggestion[] = (data ?? []).flatMap((row) => {
    const trip = (Array.isArray(row.trips) ? row.trips[0] : row.trips) as
      | { id: string; title: string }
      | null
      | undefined;
    return trip ? [{ id: trip.id, title: trip.title, source: row.role === "owner" ? ("own" as const) : ("album" as const) }] : [];
  });

  // v3.0: しおりのメンバーとして参加している旅行（自分の旅行と重複するものは除く）
  let itineraryBuilder = admin
    .from("itinerary_members")
    .select("itineraries!inner(trip_id, trips!inner(id, title))")
    .eq("user_id", user.id)
    .limit(MAX_SUGGESTIONS);
  if (query.length > 0) {
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
    itineraryBuilder = itineraryBuilder.ilike("itineraries.trips.title", `%${escaped}%`);
  }
  const { data: itineraryRows } = await itineraryBuilder;
  const seen = new Set(trips.map((trip) => trip.id));
  for (const row of (itineraryRows ?? []) as unknown as { itineraries: { trips: { id: string; title: string } | { id: string; title: string }[] } | { itineraries: unknown }[] }[]) {
    const itinerary = Array.isArray(row.itineraries) ? row.itineraries[0] : row.itineraries;
    const trip = itinerary && "trips" in itinerary ? (Array.isArray(itinerary.trips) ? itinerary.trips[0] : itinerary.trips) : null;
    if (trip && !seen.has(trip.id)) {
      seen.add(trip.id);
      trips.push({ id: trip.id, title: trip.title, source: "itinerary" });
    }
  }

  return NextResponse.json({ trips: trips.slice(0, MAX_SUGGESTIONS) });
}

/**
 * POST /api/trips — アルバムを作る（#715）
 * 出典: 要件定義書 3.6.2「アルバム」・ワイヤーフレーム決定事項 82
 *
 * 【初心者向け】いままでアルバムは「投稿するとき」か「しおりを作るとき」にしか
 * 作られなかった。一覧から名前だけで作れるようにする。**しおりは作らない。**
 *
 * 同じ名前のアルバムが既にあれば**新しく作らず、そのアルバムを返す**
 * （`resolveTripId` と同じ考え方。同じ名前が 2 つ並ぶと見分けられないため）。
 * オーナーの会員行はトリガー（`trips_ensure_owner_membership`）が作るので、ここでは入れない。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawTitle: unknown;
  try {
    rawTitle = (await request.json())?.title;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof rawTitle !== "string") {
    return NextResponse.json({ error: "trip_title_required" }, { status: 400 });
  }

  const title = normalizeTripTitle(rawTitle);
  try {
    assertValidTripTitle(title);
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const admin = createAdminClient();
  try {
    // しおりは作らない（旅行＝アルバムだけを作る）
    const tripId = await resolveTripId(admin, user.id, title);
    return NextResponse.json({ tripId }, { status: 201 });
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
