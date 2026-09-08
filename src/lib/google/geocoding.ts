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
