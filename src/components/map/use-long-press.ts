/**
 * pin-interaction-v3 Task2: 長押しの判定
 * 出典: docs/tasks/map-search/pin-interaction-v3/02-long-press.md
 *       要件定義書 v3.0 3.4.4（500ms 静止で長押し。動かしたら取り消し）
 *
 * 【初心者向け】Google マップは React の外にあるので、React のフックではなく「純粋な判定器」として作る。
 *   - start(位置)  : 押し始め。タイマーを仕掛ける
 *   - move(位置)   : 指が動いた。10px（緯度経度ではなく画面上の距離）を超えたら取り消し
 *   - cancel()     : 離した・ドラッグが始まった・別の操作が来た → 取り消し
 * 500ms 経っても取り消されなければ onLongPress(位置) を呼ぶ。マウスの右クリック（contextmenu）は
 * 即時に長押し扱いにする（trigger）。タイマーは差し替え可能にして、テストで時間を進められるようにしている。
 */
export const LONG_PRESS_MS = 500;
/** これ以上動いたら「ドラッグ」とみなして長押しを取り消す（px） */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export interface LongPressPoint {
  lat: number;
  lng: number;
  /** 画面座標（動いた距離の判定用。無ければ move では取り消さない） */
  x?: number;
  y?: number;
}

export interface LongPressDetector {
  start: (point: LongPressPoint) => void;
  move: (point: LongPressPoint) => void;
  cancel: () => void;
  /** 右クリックなど「即時に長押し」として扱う */
  trigger: (point: LongPressPoint) => void;
  isPending: () => boolean;
}

export function createLongPressDetector(
  onLongPress: (point: { lat: number; lng: number }) => void,
  options: {
    delayMs?: number;
    toleranceEnabledPx?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (id: unknown) => void;
  } = {}
): LongPressDetector {
  const delay = options.delayMs ?? LONG_PRESS_MS;
  const tolerance = options.toleranceEnabledPx ?? LONG_PRESS_MOVE_TOLERANCE_PX;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let timer: unknown = null;
  let origin: LongPressPoint | null = null;

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    origin = null;
  };

  return {
    start: (point) => {
      cancel();
      origin = point;
      timer = setTimer(() => {
        timer = null;
        const target = origin;
        origin = null;
        if (target) onLongPress({ lat: target.lat, lng: target.lng });
      }, delay);
    },
    move: (point) => {
      if (!origin || timer === null) return;
      if (typeof point.x !== "number" || typeof point.y !== "number" || typeof origin.x !== "number" || typeof origin.y !== "number") return;
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      if (distance > tolerance) cancel();
    },
    cancel,
    trigger: (point) => {
      cancel();
      onLongPress({ lat: point.lat, lng: point.lng });
    },
    isPending: () => timer !== null,
  };
}
