/**
 * F-PO-01 スポット指定 Task2: Google Places API 呼び出し
 * 出典: docs/tasks/posts/spot-selection/02-spot-search-handler.md
 *       要件定義書6.2（呼び出しはRoute Handlers経由。フロントエンドから直接呼び出さない）
 *
 * スポットを`spots`に登録するには緯度経度が必要なため、place_idしか返さない
 * Autocomplete APIではなくText Search（New）を使い、1回の呼び出しで座標まで取得する。
 */
const TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

export interface PlaceCandidate {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
}

/** Places APIの障害（要件6.2）。呼び出し元はこれを捕捉して手動登録の導線を維持する。 */
export class PlacesApiError extends Error {}

interface TextSearchResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  }[];
}

export async function searchPlaces(query: string, limit: number): Promise<PlaceCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesApiError("GOOGLE_PLACES_API_KEY is not set");
  }

  let response: Response;
  try {
    response = await fetch(TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "ja",
        maxResultCount: limit,
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new PlacesApiError(error instanceof Error ? error.message : "request failed");
  }

  if (!response.ok) {
    throw new PlacesApiError(`Places API responded with ${response.status}`);
  }

  const data = (await response.json()) as TextSearchResponse;

  return (data.places ?? []).flatMap((place) => {
    const name = place.displayName?.text;
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;

    if (!place.id || !name || typeof lat !== "number" || typeof lng !== "number") {
      return [];
    }
    return [{ placeId: place.id, name, lat, lng }];
  });
}

/**
 * search-top Task1（v3.0）: 行き先候補（駅・市区町村）のオートコンプリート
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md
 *       要件定義書 v3.0 3.4.1・6.2
 *
 * 【初心者向け】Autocomplete（New）は「入力途中の文字列 → 候補の名前」を返すだけで座標は返さない。
 * 検索トップでは候補の名前を見せ、決定したときに Geocoding（/api/geocode）で座標にする。
 * `includedPrimaryTypes` で駅と市区町村に限定し、日本国内（includedRegionCodes: jp）に絞る。
 * `sessionToken` を付けると 1 回の入力セッションとしてまとめて課金される（呼び出し回数を抑える）。
 */
const AUTOCOMPLETE_ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

export interface RegionSuggestion {
  placeId: string;
  /** 例: 大阪駅 */
  name: string;
  /** 例: 大阪府大阪市北区 */
  secondaryText: string | null;
  kind: "station" | "locality";
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      types?: string[];
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      text?: { text?: string };
    };
  }[];
}

export async function autocompleteRegions(query: string, sessionToken: string | null, limit: number): Promise<RegionSuggestion[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesApiError("GOOGLE_PLACES_API_KEY is not set");
  }

  let response: Response;
  try {
    response = await fetch(AUTOCOMPLETE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input: query,
        languageCode: "ja",
        includedRegionCodes: ["jp"],
        includedPrimaryTypes: ["train_station", "subway_station", "transit_station", "locality", "sublocality_level_1"],
        ...(sessionToken ? { sessionToken } : {}),
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new PlacesApiError(error instanceof Error ? error.message : "request failed");
  }
  if (!response.ok) {
    throw new PlacesApiError(`Places Autocomplete responded with ${response.status}`);
  }

  const data = (await response.json()) as AutocompleteResponse;
  return (data.suggestions ?? [])
    .flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      const name = prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text;
      if (!prediction?.placeId || !name) return [];
      const types = prediction.types ?? [];
      const kind: RegionSuggestion["kind"] = types.some((t) => t.includes("station")) ? "station" : "locality";
      return [{ placeId: prediction.placeId, name, secondaryText: prediction.structuredFormat?.secondaryText?.text ?? null, kind }];
    })
    .slice(0, limit);
}
