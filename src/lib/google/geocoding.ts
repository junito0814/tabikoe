/**
 * F-PO-01 スポット指定 Task6: 逆ジオコーディングによる都道府県判定
 * 出典: docs/tasks/posts/spot-selection/06-prefecture-reverse-geocoding.md
 *       要件定義書6.3
 *
 * APIキーはサーバー側のみで保持し、フロントエンドには一切露出させない。
 * 結果はスポット登録時に一度だけ`spots.prefecture`へ保存し、
 * ステータスバッジ（F-BG）の都道府県判定で利用する。
 */
const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export class GeocodingApiError extends Error {}

interface GeocodeResponse {
  status?: string;
  results?: {
    address_components?: {
      long_name?: string;
      types?: string[];
    }[];
  }[];
}

/**
 * 緯度経度から都道府県名を得る。判定できなかった場合はnullを返す
 * （スポット登録自体は続行させるため、呼び出し元で握りつぶしてよい）。
 */
export async function reverseGeocodePrefecture(
  lat: number,
  lng: number
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    throw new GeocodingApiError("GOOGLE_GEOCODING_API_KEY is not set");
  }

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", "ja");
  url.searchParams.set("result_type", "administrative_area_level_1");
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new GeocodingApiError(error instanceof Error ? error.message : "request failed");
  }

  if (!response.ok) {
    throw new GeocodingApiError(`Geocoding API responded with ${response.status}`);
  }

  const data = (await response.json()) as GeocodeResponse;

  if (data.status === "ZERO_RESULTS") {
    return null;
  }
  if (data.status !== "OK") {
    throw new GeocodingApiError(`Geocoding API returned status ${data.status}`);
  }

  for (const result of data.results ?? []) {
    for (const component of result.address_components ?? []) {
      if (component.types?.includes("administrative_area_level_1") && component.long_name) {
        return component.long_name;
      }
    }
  }

  return null;
}

/**
 * F-MP-02 Task1: 地名 → 緯度経度（ジオコーディング）
 * 出典: docs/tasks/map-search/place-search/01-geocode-handler.md
 *       要件定義書3.4.2・6.3
 */
export interface GeocodedPlace {
  lat: number;
  lng: number;
  /** Google が整形した住所（検索結果の確認表示用） */
  formattedAddress: string | null;
}

interface ForwardGeocodeResponse {
  status?: string;
  results?: {
    formatted_address?: string;
    geometry?: { location?: { lat?: unknown; lng?: unknown } };
  }[];
}

/**
 * Geocoding API のレスポンスから最初の結果の緯度経度を取り出す。
 * 結果なし・座標が数値でない場合は null。単体テストの対象（Route Handler の分岐から切り出している）。
 */
export function extractGeocodedPlace(data: ForwardGeocodeResponse): GeocodedPlace | null {
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    throw new GeocodingApiError(`Geocoding API returned status ${data.status}`);
  }
  const first = data.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng, formattedAddress: first?.formatted_address ?? null };
}

/** 地名から緯度経度を得る。見つからなければ null、API障害は GeocodingApiError */
export async function geocodePlace(query: string): Promise<GeocodedPlace | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    throw new GeocodingApiError("GOOGLE_GEOCODING_API_KEY is not set");
  }

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("address", query);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new GeocodingApiError(error instanceof Error ? error.message : "request failed");
  }
  if (!response.ok) {
    throw new GeocodingApiError(`Geocoding API responded with ${response.status}`);
  }

  return extractGeocodedPlace((await response.json()) as ForwardGeocodeResponse);
}
