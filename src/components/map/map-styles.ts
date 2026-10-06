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
 *   - 山・湖などの自然地形のラベルも消す（Google のアイコンがタビコエのピンと紛らわしいため）
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
  // map-style Bug1（2026-09-26）: 山・湖などの自然地形は `poi` ではなく `landscape.natural` なので、
  // 上の poi の指定では消えない。投稿が無い富士山に Google の緑のアイコンが出ていて、
  // 自然・景勝地のピン（緑＋山の記号）と見分けが付かなかった。
  // 駅名と同じ「アイコンだけ消して名前は残す」は、この種別では Google の仕様上できない
  // （labels.icon を消すと名前も消える。3 通り試して確認）。地名も消えるのは承知のうえで消す。
  { featureType: "landscape.natural", elementType: "labels", stylers: [{ visibility: "off" }] },
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

/**
 * 指で地図をどこまで操作できるか（map-sheet Task1 / 要件定義書 4.5.8）
 *   none        … 何もできない（見るだけ）
 *   cooperative … 2 本指でだけ動かせる。1 本指のドラッグは画面の縦スクロールに使われる
 *   greedy      … 1 本指でも動かせる（全画面の地図）
 */
export type MapGesture = "none" | "cooperative" | "greedy";

/**
 * 指で触れる端末（スマホ・タブレット）かどうか。
 *
 * 【初心者向け】画面の幅ではなく「指で触れるか」で見ている（`(pointer: coarse)`）。
 * サーバー側の描画とテストでは false（＝ボタンを出す側）に倒す。
 */
export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** スマホ幅の境目（Tailwind の `md` と同じ） */
export const PHONE_MAX_WIDTH_PX = 767;

/**
 * #801（2026-10-06）: スマホ幅かどうか。
 *
 * 【初心者向け】拡大縮小ボタンを隠す条件を「指で触れるか」だけで見ていたところ、
 * **投稿を書く画面の地図にだけ ＋/− が出ていました**。Google マップのアプリにボタンは無く、
 * 指でつまんで広げるだけです。幅でも見るようにして、スマホ幅ではどの地図にも出しません。
 * パソコン（768px 以上・指で触れない）では今までどおり出します。
 */
export function isPhoneWidth(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`).matches;
}

/**
 * map-display-v3 Task3 / map-sheet Task1: `new google.maps.Map(...)` に渡すオプション一式（単体テストの対象）
 * 3D・建物・ストリートビュー・地図タイプ切替を無効化し、テーマとズームに応じたスタイルを付ける。
 *
 * 拡大縮小ボタン（＋ −）を出すのは「全画面の地図（greedy）」で「指で触れず、スマホ幅でもない」ときだけ（4.5.8・#801）。
 * 上部の地図（cooperative）では、領域が狭いので端末を問わず出さない。
 *
 * #787（2026-10-06）: キーボード ショートカットの印（⌨）は**どの地図でも出さない**。
 * スマホにキーボードは無く、右下の場所を取るだけだった。
 * 「地図データ ©2026」「利用規約」の表記は Google が別に出すので、これで消えることはない。
 */
export function buildMapOptions(theme: MapTheme, zoom: number, gesture: MapGesture = "greedy") {
  return {
    ...MAP_UI_OPTIONS,
    zoomControl: gesture === "greedy" && !isCoarsePointer() && !isPhoneWidth(),
    gestureHandling: gesture,
    keyboardShortcuts: false,
    styles: buildMapStyles(theme, zoom),
  };
}

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
