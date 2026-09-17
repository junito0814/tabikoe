/**
 * arrival-time Task1: しおりのスポットの並び順
 * 出典: docs/tasks/itinerary/arrival-time/01-spot-update-api-and-ordering.md
 *       要件定義書 v3.0 3.11.3
 *
 * 【初心者向け】同じ Day の中では「到着予定時刻があるものを時刻順」→「無いものを手動順（sort_order）で末尾」。
 * チェック（済み）で位置は変えない。純粋関数なので単体テストしやすい。
 * arrival_time は "HH:MM" または "HH:MM:SS"（DB の time 型）。文字列比較で時刻順になる。
 */
export interface OrderableSpot {
  arrivalTime: string | null;
  sortOrder: number;
}

export function orderSpots<T extends OrderableSpot>(spots: T[]): T[] {
  const timed = spots.filter((spot) => spot.arrivalTime !== null).sort((a, b) => {
    const diff = (a.arrivalTime as string).localeCompare(b.arrivalTime as string);
    return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
  });
  const untimed = spots.filter((spot) => spot.arrivalTime === null).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...timed, ...untimed];
}

/** 10 分刻み（HH:00／HH:10／…／HH:50）か。秒があっても 00 のみ許す */
export function isTenMinuteTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  return hour >= 0 && hour <= 23 && minute % 10 === 0 && minute <= 50 && second === 0;
}

/** "HH:MM:SS" → "HH:MM" */
export function toHHMM(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}
