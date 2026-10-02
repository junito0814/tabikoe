import { haversineMeters } from "@/lib/geo/walk-minutes";
import type { TravelMode } from "@/lib/geo/travel-time";

/**
 * mentoring-7 Task7（v3.1）: 地図（SC-02）の状態の保存と復元
 * 出典: docs/tasks/shared-ui/mentoring-7/07-map-state-restore.md
 *       要件定義書 v3.1 3.4.3「地図の状態の復元」（受入条件 46）
 *
 * 【初心者向け】地図 → 詳細 → 地図 と戻ってきたとき、見ていた場所がずれないように、
 * 地図の中心・ズーム・モード（探すモードなら移動手段も）を sessionStorage に覚えておく（list-state.ts と同じ作り）。
 *   - `entry` は「どの入口で開いた地図か」（default／explore／spot:<id>／itinerary:<id>）。
 *     復元するのは「同じ入口に戻ってきたとき」だけ。別の入口（一覧の地図・しおりの地図）から新しく開いたときは復元しない
 *   - 素の /map（entry=default）で開いたときは、直前の地図が探すモードならそのまま探すモードで復元する（吹き出しの一覧 → ← 地図 の流れ）
 *   - 30 分で捨てる。sessionStorage なのでタブを閉じると消える
 */
export type MapEntry = "default" | "explore" | `spot:${string}` | `itinerary:${string}`;

export interface MapState {
  entry: MapEntry;
  mode: "default" | "explore" | "spot" | "itinerary";
  center: { lat: number; lng: number };
  zoom: number;
  /** 探すモードの移動手段（v3.2。徒歩／自転車／車／電車／バス） */
  travel?: TravelMode;
  /**
   * map-restore Task1（2026-09-25）: 探すモードを「開いたとき」の現在地。
   * 復元してよいかの判定に使う（今の中心はカードのスライドで動くので判定には使えない）
   */
  openedAt?: { lat: number; lng: number };
  /** map-restore Task1: 選んでいたカードのスポット。戻ったとき同じカードを中央に戻す */
  activeSpotId?: string | null;
  /**
   * explore-mode Task 4（2026-10-02）: 探すモードの絞り込み。**クエリ文字列のまま**覚える
   * （例 `categories=カフェ&rating=4`）。
   *
   * 【初心者向け】入れ物の形（オブジェクト）で覚えると、読み戻すときに中身を 1 つずつ確かめる
   * コードがここにも要る。文字列にしておけば、確かめるのは URL のときと同じ `parseSpotFilters`
   * だけで済む（約束 14）。
   */
  filters?: string;
}

const KEY = "tabikoe:map-state";
const MAX_AGE_MS = 30 * 60 * 1000;

interface StoredMapState extends MapState {
  savedAt: number;
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function saveMapState(state: MapState, storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    const stored: StoredMapState = { ...state, savedAt: Date.now() };
    storage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // 容量超過やプライベートモードでは黙って諦める
  }
}

/** 直前の地図の状態。無い・古い・壊れていれば null */
export function loadMapState(storage: Storage | undefined = defaultStorage(), now: number = Date.now()): MapState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMapState>;
    if (
      typeof parsed.entry !== "string" ||
      typeof parsed.mode !== "string" ||
      !parsed.center ||
      typeof parsed.center.lat !== "number" ||
      typeof parsed.center.lng !== "number" ||
      typeof parsed.zoom !== "number" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (now - parsed.savedAt > MAX_AGE_MS) return null;
    return {
      entry: parsed.entry as MapEntry,
      mode: parsed.mode as MapState["mode"],
      center: { lat: parsed.center.lat, lng: parsed.center.lng },
      zoom: parsed.zoom,
      ...(parsed.travel !== undefined ? { travel: parsed.travel } : {}),
      ...(parsed.openedAt && typeof parsed.openedAt.lat === "number" && typeof parsed.openedAt.lng === "number"
        ? { openedAt: { lat: parsed.openedAt.lat, lng: parsed.openedAt.lng } }
        : {}),
      ...(typeof parsed.activeSpotId === "string" ? { activeSpotId: parsed.activeSpotId } : {}),
      ...(typeof parsed.filters === "string" ? { filters: parsed.filters } : {}),
    };
  } catch {
    return null;
  }
}

export function clearMapState(storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // 無視
  }
}

/** 開き方（URL クエリ）から入口の種類を決める */
export function mapEntryFor(open: { mode: string; focusSpotId: string | null; itineraryId: string | null }): MapEntry {
  if (open.mode === "spot" && open.focusSpotId) return `spot:${open.focusSpotId}`;
  if (open.mode === "itinerary" && open.itineraryId) return `itinerary:${open.itineraryId}`;
  if (open.mode === "explore") return "explore";
  return "default";
}

/** 探すモードで「同じ場所から開き直した」とみなす距離。これより離れていれば移動したので新しく開く */
export const EXPLORE_SAME_PLACE_METERS = 500;

/**
 * 復元してよいか（純粋関数）。
 *   - 同じ入口に戻ってきた（entry が一致）→ 復元
 *   - 素の /map（default）で開いた → 直前が何であれ復元（探すモードなら探すモードのまま）
 *   - 探すモードは URL に現在地が付くので、保存した中心から 500m 以内なら「戻ってきた」、離れていれば「移動して開き直した」とみなして復元しない
 *   - それ以外（別の入口から新しく開いた）→ 復元しない
 */
/**
 * 復元してよいか（map-restore Task1 で判定を変更。2026-09-25）
 *
 * 【初心者向け】判断の材料は「同じ入口から戻ってきたか」。以前は探すモードだけ「今回の現在地と、保存した
 * 地図の中心が 500m 以内か」で見ていたが、カードを横にスライドすると地図がそのスポットへ動くので、
 * 保存される中心は現在地から離れる（車なら 10km まで）。そのため戻るたびに復元が見送られ、初期値に戻っていた。
 * 「別の街で開き直したら初期位置」という元の狙いは、探すモードを“開いたとき”の現在地（openedAt）と
 * 今回の現在地を比べて保つ。現在地が取れないときは復元する（取り直しを待たない）。
 */
export function shouldRestoreMapState(entry: MapEntry, saved: MapState | null, requestedCenter: { lat: number; lng: number } | null = null): saved is MapState {
  if (!saved) return false;
  if (entry === "default") return true;
  if (saved.entry !== entry) return false;
  if (entry === "explore" && requestedCenter && saved.openedAt) {
    return haversineMeters(requestedCenter, saved.openedAt) <= EXPLORE_SAME_PLACE_METERS;
  }
  return true;
}

