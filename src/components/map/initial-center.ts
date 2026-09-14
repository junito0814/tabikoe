/**
 * F-MP-01 Task3: 初期表示位置の決定
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md
 *       要件定義書3.4.1（初期表示位置）
 *
 * 位置情報の利用が許可されていれば現在地、拒否・未対応・取得失敗なら東京駅周辺。
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 東京駅周辺（緯度35.6812、経度139.7671） */
export const TOKYO_STATION: LatLng = { lat: 35.6812, lng: 139.7671 };

/** 現在地が取れた時のズーム。周辺のピンが見える程度 */
export const CURRENT_LOCATION_ZOOM = 14;
/** 東京駅フォールバック時のズーム */
export const FALLBACK_ZOOM = 13;

/** 現在地の取得を待つ上限。これを超えたら東京駅にする（無言で待ち続けない） */
const GEOLOCATION_TIMEOUT_MS = 8000;

export interface InitialCenter {
  center: LatLng;
  zoom: number;
  source: "current" | "fallback";
}

/** `navigator.geolocation` と同じ形。テストでは差し替える */
export type GeolocationLike = Pick<Geolocation, "getCurrentPosition"> | undefined;

export function resolveInitialCenter(geolocation: GeolocationLike): Promise<InitialCenter> {
  const fallback: InitialCenter = { center: TOKYO_STATION, zoom: FALLBACK_ZOOM, source: "fallback" };

  if (!geolocation) {
    return Promise.resolve(fallback);
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          center: { lat: position.coords.latitude, lng: position.coords.longitude },
          zoom: CURRENT_LOCATION_ZOOM,
          source: "current",
        }),
      () => resolve(fallback),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60000 }
    );
  });
}
