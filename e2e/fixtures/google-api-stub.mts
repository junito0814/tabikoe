// e2e-foundation Task 4: サーバーが呼ぶ Google（Places・Geocoding・Routes）の偽物（スタブ）
// 出典: docs/tasks/shared-ui/e2e-foundation/04-maps-stub.md
//
// 【初心者向け】E2E のアプリは `GOOGLE_API_BASE_URL=http://127.0.0.1:3199` で動かす（playwright.config.ts）。
// すると src/lib/google/ の 4 ファイルは、本物の Google ではなく、ここに問い合わせる（src/lib/google/base-url.ts）。
// ここは Google と同じ形の「決まった答え」を返すので、課金されず、答えも毎回同じになる。
//
// 呼ばれた回数も数えている。`GET /__calls` で読み、`POST /__reset` で 0 に戻す。
// 「呼ばれたこと」「呼ばれていないこと」をテストから確かめるため。
//
// 起動は Playwright の webServer（playwright.config.ts）。Node の型の読み飛ばし（type stripping）で、そのまま動く。
// .mts にしているのは、このファイルを ES モジュールとして読ませるため（package.json に "type": "module" が無い）。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export const GOOGLE_STUB_PORT = 3199;

/** 決まった答え（テストからも同じ値を読む） */
export const STUB_ANSWERS = {
  /** スポット候補（Text Search）。どの言葉で探しても、この 1 件を返す */
  place: { id: "E2E_STUB_KAMINARIMON", name: "雷門", lat: 35.7111, lng: 139.7963 },
  /** 行き先の候補（Autocomplete） */
  station: { placeId: "E2E_STUB_TOKYO_STATION", name: "東京駅", secondaryText: "東京都千代田区" },
  /** 座標化（住所→位置）と、その逆（位置→都道府県） */
  geocode: { lat: 35.681236, lng: 139.767125, prefecture: "東京都" },
  /** 公式情報（Place Details） */
  details: { openNow: true, weekdayDescriptions: ["月曜日: 6時00分～17時00分"], websiteUri: "https://example.com/" },
  /** 経路（Route Matrix）。どの目的地も 12 分 */
  routeSeconds: 720,
} as const;

const calls: Record<string, number> = {};
const count = (key: string) => {
  calls[key] = (calls[key] ?? 0) + 1;
};

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${GOOGLE_STUB_PORT}`);
  const path = url.pathname;

  // テストから読む・戻すための口
  if (path === "/__calls") return send(response, 200, calls);
  if (path === "/__reset" && request.method === "POST") {
    for (const key of Object.keys(calls)) delete calls[key];
    return send(response, 200, { ok: true });
  }
  if (path === "/__health") return send(response, 200, { ok: true });

  // Places: スポット候補
  if (path === "/places/v1/places:searchText" && request.method === "POST") {
    count("places:searchText");
    const { place } = STUB_ANSWERS;
    return send(response, 200, {
      places: [{ id: place.id, displayName: { text: place.name }, location: { latitude: place.lat, longitude: place.lng } }],
    });
  }
  // Places: 行き先の候補（駅・市区町村）
  if (path === "/places/v1/places:autocomplete" && request.method === "POST") {
    count("places:autocomplete");
    const { station } = STUB_ANSWERS;
    return send(response, 200, {
      suggestions: [
        {
          placePrediction: {
            placeId: station.placeId,
            types: ["train_station"],
            structuredFormat: { mainText: { text: station.name }, secondaryText: { text: station.secondaryText } },
          },
        },
      ],
    });
  }
  // Places: 公式情報（営業時間・公式サイト）
  if (path.startsWith("/places/v1/places/") && request.method === "GET") {
    count("places:details");
    const { details } = STUB_ANSWERS;
    return send(response, 200, {
      regularOpeningHours: { openNow: details.openNow, weekdayDescriptions: details.weekdayDescriptions },
      websiteUri: details.websiteUri,
    });
  }
  // Geocoding: 位置→都道府県（latlng）と、住所→位置（address）
  if (path === "/maps/maps/api/geocode/json") {
    const { geocode } = STUB_ANSWERS;
    if (url.searchParams.has("latlng")) {
      count("geocode:reverse");
      return send(response, 200, {
        status: "OK",
        results: [{ address_components: [{ long_name: geocode.prefecture, types: ["administrative_area_level_1", "political"] }] }],
      });
    }
    count("geocode:forward");
    return send(response, 200, { status: "OK", results: [{ geometry: { location: { lat: geocode.lat, lng: geocode.lng } } }] });
  }
  // Routes: 出発地から各目的地までの所要時間
  if (path === "/routes/distanceMatrix/v2:computeRouteMatrix" && request.method === "POST") {
    count("routes:matrix");
    const body = await readJson(request);
    const destinations = Array.isArray(body.destinations) ? body.destinations.length : 0;
    return send(
      response,
      200,
      Array.from({ length: destinations }, (_, index) => ({
        originIndex: 0,
        destinationIndex: index,
        duration: `${STUB_ANSWERS.routeSeconds}s`,
        condition: "ROUTE_EXISTS",
      }))
    );
  }

  // 知らない口は数えて 404（スタブに足りない口があれば、ここで気づける）
  count(`unknown:${request.method} ${path}`);
  return send(response, 404, { error: "not_stubbed", path });
}

// `node e2e/fixtures/google-api-stub.mts` で直接起動されたときだけ待ち受ける（テストから import したときは起動しない）。
// `import.meta` で見分けたいところだが、Playwright はこのファイルを CommonJS として読み込むので使えない。起動したファイル名で見る
if (process.argv[1]?.endsWith("google-api-stub.mts")) {
  createServer((request, response) => {
    handle(request, response).catch((error) => send(response, 500, { error: String(error) }));
  }).listen(GOOGLE_STUB_PORT, "127.0.0.1", () => {
    console.log(`Google のスタブ: http://127.0.0.1:${GOOGLE_STUB_PORT}`);
  });
}
