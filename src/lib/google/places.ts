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
