/**
 * spot-status-report Task2: 「まだあった」報告のラベル整形
 * 出典: docs/tasks/browsing/spot-status-report/02-detail-buttons-and-display.md
 *       要件定義書 v3.0 3.5.5
 *
 * 【初心者向け】最新の報告 1 件を「9月にまだあった」「8月に無くなっていたとの報告」の形にする。
 * 月は日本時間（JST）で数える（UTC のままだと月末の深夜に月がずれる）。
 * 報告が無ければ null を返し、呼び出し側は何も描画しない（受入条件: 報告が無いスポットには何も出さない）。
 */
export type SpotStatus = "still_there" | "gone";

export interface LatestSpotStatus {
  status: SpotStatus;
  /** ISO 8601 */
  reportedAt: string;
}

export const SPOT_STATUS_LABELS: Record<SpotStatus, string> = {
  still_there: "まだあった",
  gone: "無くなっていた",
};

/** JST の月（1〜12）。不正な日時なら null */
export function monthInJst(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // UTC に 9 時間足した値の「UTC の月」が JST の月になる
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
}

export function formatStatusLabel(latest: LatestSpotStatus | null | undefined): string | null {
  if (!latest) return null;
  const month = monthInJst(latest.reportedAt);
  if (month === null) return null;
  return latest.status === "still_there" ? `${month}月にまだあった` : `${month}月に無くなっていたとの報告`;
}
