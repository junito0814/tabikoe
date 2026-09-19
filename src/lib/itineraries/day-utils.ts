/**
 * itinerary-days Task1: 期間と Day の計算
 * 出典: docs/tasks/itinerary/itinerary-days/01-period-update-and-day-recalc.md
 *       要件定義書 v3.0 3.11.2
 *
 * 【初心者向け】日付は "YYYY-MM-DD" の文字列で扱い、Date のタイムゾーンのずれを避けるため UTC で計算する。
 *   - dayCount(start, end)  : 9/20〜9/22 → 3
 *   - dayDate(start, n)     : Day n の日付（Day 1 = start）
 *   - clampDayIndex(day, count): 期間を縮めて Day が範囲外になったら null（未定）へ
 */
export const MAX_ITINERARY_DAYS = 31;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** 期間の日数。未設定なら 0 */
export function dayCount(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const days = Math.round((toUtc(endDate) - toUtc(startDate)) / 86400000) + 1;
  return days >= 1 ? days : 0;
}

/** Day n（1 始まり）の日付。期間が無ければ null */
export function dayDate(startDate: string | null, dayIndex: number): string | null {
  if (!startDate || dayIndex < 1) return null;
  return new Date(toUtc(startDate) + (dayIndex - 1) * 86400000).toISOString().slice(0, 10);
}

/** 「9/20（金）」の形。日付が無ければ空文字 */
export function formatDayLabel(date: string | null, options: { withYear?: boolean } = {}): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${weekday}）`;
  return options.withYear ? `${d.getUTCFullYear()}/${md}` : md;
}

/** v3.1（mentoring-7 Task8）: 期間の表示は年つき「2026/9/20（金）〜 2026/9/22（日）」。未設定なら「期間未設定」 */
export function formatPeriodLabel(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "期間未設定";
  return `${formatDayLabel(startDate, { withYear: true })} 〜 ${formatDayLabel(endDate, { withYear: true })}`;
}

/** 期間の変更で範囲外になった Day は未定（null）へ */
export function clampDayIndex(dayIndex: number | null, count: number): number | null {
  if (dayIndex === null) return null;
  return dayIndex >= 1 && dayIndex <= count ? dayIndex : null;
}

export type PeriodValidation = { ok: true; startDate: string | null; endDate: string | null } | { ok: false; error: string };

/** 期間の入力検証: 両方あり（end ≥ start、31 日以内）か、両方なし */
export function validatePeriod(startDate: unknown, endDate: unknown): PeriodValidation {
  const start = startDate === null || startDate === undefined || startDate === "" ? null : startDate;
  const end = endDate === null || endDate === undefined || endDate === "" ? null : endDate;
  if (start === null && end === null) return { ok: true, startDate: null, endDate: null };
  if (start === null || end === null) return { ok: false, error: "period_incomplete" };
  if (!isDateString(start) || !isDateString(end)) return { ok: false, error: "invalid_date" };
  const count = dayCount(start, end);
  if (count < 1) return { ok: false, error: "period_reversed" };
  if (count > MAX_ITINERARY_DAYS) return { ok: false, error: "period_too_long" };
  return { ok: true, startDate: start, endDate: end };
}

/** 期間が今日より前に終わっているか（一覧の「済」表示） */
export function isPeriodPast(endDate: string | null, today: string): boolean {
  return endDate !== null && endDate < today;
}
