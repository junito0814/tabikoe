import { REPORT_REASONS, type ReportReason } from "@/lib/reports/constants";

/**
 * #892 / 要件定義書 6.8（2026-10-11）: 通報を Jev に見立ててもらうときの**判断**。
 *
 * 【初心者向け】ここには Jev を呼ぶ処理を置いていません。**純粋関数だけ**です（約束 13）。
 *   「どの色で出すか」「見立てを出してよいか」は、外の仕組みが動いていなくても
 *   数字だけでテストできます。Jev を呼ぶところは `evaluate-report.ts`。
 *
 * **Jev は決めません。見せるだけです。** 決めるのは運営者で、
 * **投稿が自動で消えたり非公開になったりすることはありません**（要件 6.8）。
 */

/** 緊急度の段。札の色を決める */
export type UrgencyLevel = "high" | "mid" | "low";

/**
 * 緊急度（0〜3）を 3 段に分ける。
 *
 * **境目は実測から決めた**（2026-10-11、日本語の通報 4 件）。
 *   電話番号が書かれている 2.79 ／ 顔の写り込み 2.23 ／ 宣伝の繰り返し 1.53 ／ ただの感想 0.28
 */
export const URGENCY_HIGH = 2.5;
export const URGENCY_MID = 1.5;

export function urgencyLevel(score: number): UrgencyLevel {
  if (score >= URGENCY_HIGH) return "high";
  if (score >= URGENCY_MID) return "mid";
  return "low";
}

/** 画面に出す形（「2.8」）。小数 1 桁 */
export function formatUrgency(score: number): string {
  return score.toFixed(1);
}

/**
 * 見立てを出してよい確信の下限。
 *
 * 【初心者向け】**迷っているものは出しません**（要件 6.8）。
 * 自信の無い見立てを並べると、運営者が**それを信じて間違える**ほうが害が大きいためです。
 */
export const MIN_CONFIDENCE = 0.7;

/** Jev が返した値が、通報理由の 8 択のどれかであること（知らない言葉が来ても落ちない） */
export function isReportReason(value: string | null): value is ReportReason {
  return value !== null && (REPORT_REASONS as readonly string[]).includes(value);
}

export interface JevVerdict {
  urgency: number | null;
  reason: string | null;
  confidence: number | null;
}

/**
 * 見立てを画面に出してよいか。
 *
 * **「その他」は出しません。** Jev にとっての「その他」は「**どれでもない**」であって、
 * 運営者が次にすることが何も変わりません。確信が高くても、出す値打ちがない。
 */
export function shouldShowReason(verdict: JevVerdict): verdict is JevVerdict & { reason: ReportReason } {
  if (!isReportReason(verdict.reason)) return false;
  if (verdict.reason === "other") return false;
  return verdict.confidence !== null && verdict.confidence >= MIN_CONFIDENCE;
}

/**
 * 通報した人が選んだ理由と、Jev の見立てが**食い違っているか**。
 *
 * 【初心者向け】ここがいちばん値打ちのあるところです。
 *   2026-10-04 の測定で、利用者が「その他」として送った通報を Jev が
 *   「個人情報の掲載」と見立て直しました。**合っているときの見立てはただの重複**で、
 *   食い違ったときだけが、運営者にとっての新しい情報です。
 */
export function differsFromReporter(reported: ReportReason, verdict: JevVerdict): boolean {
  return shouldShowReason(verdict) && verdict.reason !== reported;
}

/**
 * いちばん古い未対応が何日前か。
 *
 * 【初心者向け】並び順を「緊急度が高い順」にしたので、**古い通報が埋もれます**。
 * もとの「古い順」には「古いものを放置しない」という目的があったので、
 * その目的だけを**一覧の上の 1 行**で守ります（決定事項 89）。
 */
export function oldestOpenDays(createdAt: readonly string[], now: Date): number | null {
  let oldest: number | null = null;
  for (const iso of createdAt) {
    const time = Date.parse(iso);
    if (Number.isNaN(time)) continue;
    const days = Math.floor((now.getTime() - time) / 86_400_000);
    if (oldest === null || days > oldest) oldest = days;
  }
  return oldest;
}
