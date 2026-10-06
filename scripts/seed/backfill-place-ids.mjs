// #755: place_id が空の「Google 由来」のスポットに、あとから Place ID を埋める
//
// 使い方:
//   node scripts/seed/backfill-place-ids.mjs          … 何が入るか見るだけ（書き込まない）
//   node scripts/seed/backfill-place-ids.mjs --apply  … 実際に書き込む
//
// 【初心者向け】なぜ空のままのスポットがあるのか。
//   `place_id` を保存するようにしたのは #700（20261005000001_spots_place_id.sql）で、
//   **それより前に作られたスポットは持っていません**。`OfficialInfo` は `place_id` が無いと
//   何も出さない作りなので（手で登録した場所には Google の情報が無いため。これは意図どおり）、
//   大阪城のような有名な場所でも営業時間が出ませんでした。
//
// 安全のための決まり（間違えると**他人の店の営業時間**が出てしまう）
//   1. `source = "places"`（Google 由来）で `place_id` が空のものだけを見る
//   2. 名前＋座標で引く（座標のまわり 2km に寄せる。遠くの同名の店を拾わないため）
//   3. **名前と座標の両方**で確かめる。判断は `src/lib/spots/place-id-match.ts` の
//      `matchesSpot`（純粋関数・単体テストあり）に任せる
//   4. 迷ったら入れない。空のままなら「公式情報が出ない」だけで済むが、
//      間違えると**別の場所の情報を出す**ことになる
//
// 手で登録したスポット（source = "manual"）は Google に無い想定なので触りません（#755 で確認済み）。
//
// 【初心者向け】判断を `.ts` から読み込んでいるのは、**画面と同じ決まりを 2 か所に書かない**ため（約束 14）。
// Node 24 は型注釈を読み飛ばせるので、`.mjs` から `.ts` をそのまま import できます。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { matchesSpot, withoutSeedMarker } from "../../src/lib/spots/place-id-match.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const apiKey = env.GOOGLE_PLACES_API_KEY;
if (!apiKey) throw new Error(".env.local に GOOGLE_PLACES_API_KEY が要ります");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const apply = process.argv.includes("--apply");

/** Places Text Search（New）で 1 件引いて、結び付けてよいかを返す */
async function resolve(spot) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location",
    },
    body: JSON.stringify({
      textQuery: withoutSeedMarker(spot.name),
      languageCode: "ja",
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: spot.lat, longitude: spot.lng }, radius: 2000 } },
    }),
  });
  if (!response.ok) return { skip: `Google が ${response.status} を返した` };
  const data = await response.json();
  const place = data.places?.[0];
  if (!place?.id) return { skip: "候補なし" };

  const candidate = {
    name: place.displayName?.text ?? "",
    lat: place.location?.latitude ?? Number.NaN,
    lng: place.location?.longitude ?? Number.NaN,
  };
  const match = matchesSpot(spot, candidate);
  if (!match.ok) return { skip: match.reason };
  return { placeId: place.id, name: candidate.name, distanceM: match.distanceM };
}

const { data: spots, error } = await admin
  .from("spots")
  .select("id, name, lat, lng, source, place_id")
  .eq("source", "places")
  .is("place_id", null)
  .is("hidden_at", null)
  .order("name");
if (error) throw error;

console.log(apply ? "【書き込みます】" : "【見るだけ】（--apply を付けると書き込みます）");
console.log(`place_id が空の Google 由来のスポット: ${spots.length} 件\n`);

let filled = 0;
const skipped = [];
for (const spot of spots) {
  const result = await resolve(spot);
  if (result.skip) {
    skipped.push({ name: spot.name, reason: result.skip });
    console.log(`--  ${spot.name}  … 入れない（${result.skip}）`);
    continue;
  }
  console.log(`OK  ${spot.name}  → ${result.name}（${result.distanceM}m）  ${result.placeId}`);
  if (apply) {
    const { error: updateError } = await admin.from("spots").update({ place_id: result.placeId }).eq("id", spot.id);
    if (updateError) {
      console.log(`    書き込めませんでした: ${updateError.message}`);
      continue;
    }
  }
  filled += 1;
}

console.log(`\n${apply ? "書き込んだ" : "書き込める"}: ${filled} 件 / 入れない: ${skipped.length} 件`);
if (skipped.length > 0) {
  console.log("入れないもの（空のままでも、公式情報が出ないだけで画面は壊れません）:");
  for (const s of skipped) console.log(`  - ${s.name}: ${s.reason}`);
}
