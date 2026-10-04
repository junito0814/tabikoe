// #703: seed のスポットに Place ID を付ける（結果は place-ids.json に書く）
//
// 使い方:  node scripts/seed/resolve-place-ids.mjs
//   - .env.local の GOOGLE_PLACES_API_KEY を使う
//   - 読み取りだけ。データベースには触らない
//
// 【初心者向け】なぜ結果をファイルに残すのか。
//   1. seed を入れ直すたびに Google を叩かずに済む（無料枠を使わない）
//   2. どのスポットがどの Place ID に結び付いたかが**記録として残る**
//   3. Place ID は Google から保存してよい唯一の値（要件 6.2）。保存してよいものだけを置いている
//
// 手動登録（source: "manual"）のスポットは Google に無い想定なので引かない。
import { readFileSync, writeFileSync } from "node:fs";

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

// seed-tokyo.mjs の SPOTS をそのまま読む（二重管理にしない）
const source = readFileSync(new URL("./seed-tokyo.mjs", import.meta.url), "utf8");
const block = source.match(/const SPOTS = \[([\s\S]*?)\n\];/);
if (!block) throw new Error("SPOTS が見つかりません");
const spots = [...block[1].matchAll(/\{\s*name:\s*"([^"]+)".*?lat:\s*([\d.]+),\s*lng:\s*([\d.]+),\s*source:\s*"(\w+)"/g)].map(
  ([, name, lat, lng, src]) => ({ name, lat: Number(lat), lng: Number(lng), source: src })
);
console.log(`スポット ${spots.length} 件（うち places ${spots.filter((s) => s.source === "places").length} 件）`);

/** 名前＋座標で引き、いちばん近い候補の ID を採る */
async function resolve(spot) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location",
    },
    body: JSON.stringify({
      textQuery: spot.name,
      languageCode: "ja",
      maxResultCount: 1,
      // 座標のまわりに寄せる（同名の別の店を拾わないため）
      locationBias: { circle: { center: { latitude: spot.lat, longitude: spot.lng }, radius: 2000 } },
    }),
  });
  if (!response.ok) return { placeId: null, matchedName: null, error: `HTTP ${response.status}` };
  const data = await response.json();
  const place = data.places?.[0];
  if (!place?.id) return { placeId: null, matchedName: null, error: "候補なし" };
  return { placeId: place.id, matchedName: place.displayName?.text ?? null, error: null };
}

const result = {
  // 記録: いつ・何で引いたか
  resolvedAt: new Date().toISOString().slice(0, 10),
  note: "Places Text Search（New）で引いた。Place ID は Google から保存してよい唯一の値（要件定義書 6.2）",
  spots: [],
};

for (const spot of spots) {
  if (spot.source !== "places") {
    result.spots.push({ name: spot.name, placeId: null, reason: "手動登録のスポット（Google に無い想定）" });
    console.log(`-  ${spot.name}: 手動登録なので引かない`);
    continue;
  }
  const { placeId, matchedName, error } = await resolve(spot);
  result.spots.push({ name: spot.name, placeId, matchedName, ...(error ? { error } : {}) });
  console.log(`${placeId ? "OK" : "--"} ${spot.name}${matchedName && matchedName !== spot.name ? ` → ${matchedName}` : ""}${error ? ` (${error})` : ""}`);
}

writeFileSync(new URL("./place-ids.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
const found = result.spots.filter((s) => s.placeId).length;
console.log(`\n書き出しました: place-ids.json（${found} / ${spots.length} 件に Place ID）`);
