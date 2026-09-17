/**
 * theme Task2 / map-display-v3 Task3: Google マップの表示スタイル（表示情報の削減とダークモード）
 * 出典: docs/tasks/shared-ui/theme/02-dark-mode-variables-and-map-style.md
 *       docs/tasks/map-search/map-display-v3/03-map-style-application.md
 *       要件定義書 v3.0 3.4.3「表示情報の削減」・6.1
 *
 * 【初心者向け】Google マップは `styles` オプションに「どの要素（featureType）の何（elementType）をどう見せるか」の
 * 配列を渡すと見た目を変えられる。タビコエのピンを主役にするため、
 *   - 店舗・施設（poi）のラベルを消す（タビコエのピンだけが場所を示す）
 *   - 交通機関は駅名だけ残す
 *   - 道路名はズーム 16 以上でだけ出す（ズームごとに styles を切り替える）
 *   - 色の彩度を落とす
 * ダークモードでは夜向けの配色に差し替える。
 */
export type MapTheme = "light" | "dark";

const HIDE_POI: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.rail", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "transit.station.rail", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

const LIGHT_BASE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ saturation: -60 }, { lightness: 12 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5563" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe3f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e3e9f0" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef2f6" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#1e2a38" }] },
];

const DARK_BASE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#111926" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b97a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }, { weight: 2 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1b3350" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e3a4b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#263142" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e6edf5" }] },
];

/** 道路名を出すズームの下限（要件定義書 v3.0 3.4.3） */
export const ROAD_LABEL_MIN_ZOOM = 16;

const HIDE_ROAD_LABELS: google.maps.MapTypeStyle[] = [
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
];

/** テーマとズームに応じた styles を返す */
export function buildMapStyles(theme: MapTheme, zoom: number): google.maps.MapTypeStyle[] {
  const base = theme === "dark" ? DARK_BASE : LIGHT_BASE;
  const roads = zoom >= ROAD_LABEL_MIN_ZOOM ? [] : HIDE_ROAD_LABELS;
  return [...base, ...HIDE_POI, ...roads];
}

/** 地図の共通オプション（3D・建物・ストリートビュー・地図タイプ切替は無効） */
export const MAP_UI_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  tilt: 0,
  clickableIcons: false,
} as const;

/** OS のダーク設定を読む（SSR やテストでは light） */
export function detectMapTheme(): MapTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** ダーク設定の切り替えを監視する。戻り値は解除関数 */
export function watchMapTheme(onChange: (theme: MapTheme) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (event: MediaQueryListEvent) => onChange(event.matches ? "dark" : "light");
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}
