import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { requireLocalSupabase } from "./local-supabase";
import { resetDatabase } from "./reset";
import { E2E_SEED_USERS } from "../../src/lib/e2e/seed-users";

/**
 * e2e-foundation Task 2: E2E 用の種データ（毎回同じ結果になる最小限）
 * 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md
 *
 * 【初心者向け】画面確認用の `scripts/seed/seed-tokyo.mjs` とは別物です。あちらは見た目を確かめるための量（多い）で、
 * こちらは**テストが当てにできる、少なくて決まった中身**です。ID も固定にして、テストから名前で指せるようにしています。
 *
 * 中身（タスク文書のとおり）
 *   - 利用者 2 名（たろう＝一般、管理者＝is_admin）
 *   - 旅行 1 件（たろうの「東京旅行」）
 *   - スポット 2 件（浅草寺・東京タワー。どちらも東京都）
 *   - 公開投稿 2 件（たろうがそれぞれに 1 件ずつ。浅草寺の投稿に写真 1 枚）
 *   - 下書き 1 件（たろう。位置だけ）
 *   - しおり 1 件（東京旅行のしおり。期間 2026-11-20〜22 の 3 日間。たろうがオーナー。中身は空）
 *     ※ Task 5 で追加（タスク 2 の一覧には無い）。「しおり詳細の Day に並ぶ」を確かめるには期間のあるしおりが要るため
 *
 * 写真は実際のファイルを Storage に置く（一覧・詳細で表示するため）。画像は sharp でその場で作るので、
 * リポジトリに画像ファイルを入れずに済む。
 */
export const SEED = {
  // 利用者 2 名はテスト専用のログイン経路と同じ定義を読む（ID とメールアドレスを 2 か所に書かない。約束 14）
  users: { taro: E2E_SEED_USERS.user, admin: E2E_SEED_USERS.admin },
  trip: { id: "00000000-0000-4000-8000-0000000000f1", title: "東京旅行" },
  itinerary: { id: "00000000-0000-4000-8000-0000000000c1", startDate: "2026-11-20", endDate: "2026-11-22" },
  spots: {
    sensoji: { id: "00000000-0000-4000-8000-0000000000a1", name: "浅草寺", lat: 35.7148, lng: 139.7967, placeId: "E2E_SENSOJI" },
    tokyoTower: { id: "00000000-0000-4000-8000-0000000000a2", name: "東京タワー", lat: 35.6586, lng: 139.7454, placeId: "E2E_TOKYO_TOWER" },
  },
  posts: {
    sensoji: { id: "00000000-0000-4000-8000-0000000000b1", comment: "朝いちばんは人が少なくて、本堂までゆっくり歩けました。", cost: 1000 },
    tokyoTower: { id: "00000000-0000-4000-8000-0000000000b2", comment: "夜の展望台から見た東京の明かりがきれいでした。" },
    draft: { id: "00000000-0000-4000-8000-0000000000b3" },
  },
  prefecture: "東京都",
} as const;

/** 写真の置き場所。アプリが作る形（`<利用者>/<任意>/resized.jpg`。src/app/api/posts/photos/route.ts）に揃える */
export const SEED_PHOTO_PATH = `${SEED.users.taro.id}/e2e-sensoji-0/resized.jpg`;

/** 手元の Supabase に、管理者の鍵で繋ぐ（RLS を通らない。種を入れるためだけに使う） */
export function adminClient(): SupabaseClient {
  const local = requireLocalSupabase();
  return createClient(local.url, local.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** 失敗したら、どの種で止まったかを出して止める（黙って先へ進まない） */
async function must<R extends { error: { message: string } | null }>(label: string, promise: PromiseLike<R>): Promise<R> {
  const result = await promise;
  if (result.error) throw new Error(`種データ（${label}）を入れられませんでした: ${result.error.message}`);
  return result;
}

export async function seedDatabase(admin: SupabaseClient = adminClient()): Promise<void> {
  // 1. ログインの利用者（auth.users）。ID を固定する
  for (const user of Object.values(SEED.users)) {
    await must(`auth ${user.email}`, admin.auth.admin.createUser({ id: user.id, email: user.email, email_confirm: true }));
  }

  // 2. アプリの利用者（public.users）と、公開中の規約への同意（無いと同意画面に飛ばされる。src/proxy.ts）
  const now = new Date().toISOString();
  await must(
    "users",
    admin.from("users").insert(
      Object.values(SEED.users).map((user) => ({
        id: user.id,
        idp_provider: "google",
        idp_subject: `e2e-${user.id}`,
        email: user.email,
        display_name: user.displayName,
        is_admin: user.isAdmin,
        consented_at: now,
      }))
    )
  );
  const { data: documents } = await must("legal_documents", admin.from("legal_documents").select("kind, version").not("published_at", "is", null));
  await must(
    "user_consents",
    admin.from("user_consents").insert(
      Object.values(SEED.users).flatMap((user) => (documents ?? []).map((doc) => ({ user_id: user.id, kind: doc.kind, version: doc.version })))
    )
  );

  // 3. 旅行・スポット
  await must("trips", admin.from("trips").insert({ id: SEED.trip.id, user_id: SEED.users.taro.id, title: SEED.trip.title }));
  await must(
    "spots",
    admin.from("spots").insert(
      Object.values(SEED.spots).map((spot) => ({
        id: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        prefecture: SEED.prefecture,
        source: "places",
        place_id: spot.placeId,
      }))
    )
  );

  // 3.5 しおり（旅行と 1 対 1。期間あり）。オーナー（旅行の持ち主＝たろう）は、データベースのトリガー
  //     （ensure_itinerary_owner_membership）が自動で登録するので、ここでは入れない
  await must(
    "itineraries",
    admin.from("itineraries").insert({ id: SEED.itinerary.id, trip_id: SEED.trip.id, start_date: SEED.itinerary.startDate, end_date: SEED.itinerary.endDate })
  );

  // 4. 公開投稿 2 件と下書き 1 件
  const published = (post: { id: string; comment: string; cost?: number }, spot: { id: string; lat: number; lng: number }, rating: number) => ({
    id: post.id,
    user_id: SEED.users.taro.id,
    trip_id: SEED.trip.id,
    spot_id: spot.id,
    category: "観光スポット",
    visit_date: "2026-10-01",
    duration: "1時間以内",
    rating,
    comment: post.comment,
    cost: post.cost ?? null,
    lat: spot.lat,
    lng: spot.lng,
    status: "published",
    published_at: now,
  });
  await must(
    "posts",
    admin.from("posts").insert([
      published(SEED.posts.sensoji, SEED.spots.sensoji, 5),
      published(SEED.posts.tokyoTower, SEED.spots.tokyoTower, 4),
      {
        id: SEED.posts.draft.id,
        user_id: SEED.users.taro.id,
        trip_id: SEED.trip.id,
        lat: SEED.spots.sensoji.lat,
        lng: SEED.spots.sensoji.lng,
        status: "draft",
      },
    ])
  );

  // 5. 写真 1 枚（実ファイル）。毎回同じ場所に上書きする
  const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 170, b: 210 } } })
    .jpeg({ quality: 80 })
    .toBuffer();
  await must("storage", admin.storage.from("post-media").upload(SEED_PHOTO_PATH, photo, { contentType: "image/jpeg", upsert: true }));
  await must(
    "post_photos",
    admin.from("post_photos").insert({ post_id: SEED.posts.sensoji.id, media_type: "photo", storage_url: SEED_PHOTO_PATH, display_order: 0 })
  );
}

/** テストの前に呼ぶ: 空にしてから種を入れ直す */
export async function resetAndSeed(): Promise<void> {
  resetDatabase();
  await seedDatabase();
}
