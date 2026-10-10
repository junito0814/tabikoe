import "server-only";
import { REPORT_REASONS } from "@/lib/reports/constants";
import { isReportReason } from "./triage-report";

/**
 * #892 / 要件定義書 6.8（2026-10-11）: 通報を Jev に見立ててもらう。
 *
 * 【初心者向け】Jev は**文章を書きません**。渡した選択肢の中から選ぶだけなので、
 *   知らない言葉を作って返してくることがありません。だから結果をそのまま保存できます。
 *
 * **ここで失敗しても、通報の受付は必ず成功させます**（要件 3.8.2）。
 *   通報は「困っている人が助けを求める操作」です。外の仕組みが落ちているせいで
 *   受け付けられない、ということがあってはいけません。失敗したら **null を返すだけ**にして、
 *   呼び出し側は何事もなかったように進みます。一覧では「―」と出ます。
 *
 * **送るのは通報の理由の文章だけです**（個人情報保護方針 7.1）。
 *   写真・動画・名前・メールアドレス・位置情報・誰が通報したかは送りません。
 */

/** 1 回の呼び出しの待ち時間。これを過ぎたら諦める（実測は 195〜477ms。2026-10-11） */
export const JEV_TIMEOUT_MS = 5000;

/** 通報理由の説明。Jev にはこの説明を読ませて選ばせる（ラベルだけでは意味が伝わらない） */
const REASON_CRITERIA: Record<string, string> = {
  inappropriate: "暴言・差別・わいせつなど、表現そのものが不適切",
  personal_info: "電話番号・住所・本名・顔など、個人を特定できる情報が載っている",
  false_info: "事実と異なることが書かれている",
  copyright: "他人の写真や文章を無断で使っている、肖像権の侵害",
  spam: "宣伝・勧誘・同じ内容の繰り返し",
  impersonation: "他人や店舗になりすましている",
  wrong_spot_info: "場所の名前・住所・営業情報が間違っている",
  other: "上のどれにも当てはまらない",
};

/** 緊急度の段づけ。0 から 3 まで、運営者が次にすることで分ける */
const URGENCY_CRITERIA = [
  "急がなくてよい",
  "いずれ確認すればよい",
  "早めに確認すべき",
  "すぐに対応すべき",
] as const;

export interface JevTriage {
  urgency: number;
  reason: string;
  confidence: number;
  model: string;
}

/** 鍵が無ければ呼ばない（開発用の環境で設定していないこともある） */
export function isJevEnabled(): boolean {
  return typeof process.env.TYPESAFE_API_KEY === "string" && process.env.TYPESAFE_API_KEY.trim().length > 0;
}

/**
 * 通報の理由の文章から、緊急度と見立てを得る。
 *
 * @returns 取れなければ **null**（落とさない）
 */
export async function evaluateReport(detail: string | null): Promise<JevTriage | null> {
  // 理由のメモが空なら、読むものが無い。呼ぶだけ無駄なので呼ばない
  if (!detail || detail.trim().length === 0) return null;
  if (!isJevEnabled()) return null;

  try {
    const { TypeSafeClient } = await import("@typesafe-ai/sdk");
    const client = new TypeSafeClient({ timeout: JEV_TIMEOUT_MS });
    const { answers, model } = await client.systemOne({
      // 何の文章かが分かる形で渡す（ただの文字列より、Jev が迷いにくい）
      state: { 通報の理由: detail },
      questions: {
        urgency: {
          type: "score",
          instructions: "この通報に、運営はどれくらい急いで対応すべきか。",
          criteria: URGENCY_CRITERIA,
        },
        reason: {
          type: "choice",
          instructions: "この通報は、どの理由にいちばん近いか。",
          criteria: REASON_CRITERIA,
        },
      },
    });

    const reason = String(answers.reason.choice);
    // 渡した選択肢以外は返らない決まりだが、**信じずに確かめる**（知らない値を保存しない）
    if (!isReportReason(reason)) return null;

    return {
      urgency: Math.min(Math.max(answers.urgency.score, 0), URGENCY_CRITERIA.length - 1),
      reason,
      confidence: answers.reason.confidence,
      model,
    };
  } catch (error) {
    // 落ちていても通報は通す。何が起きたかだけ残す
    console.error("[jev] 通報の見立てを取れませんでした:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** 選択肢が 8 つとも揃っているか（通報理由が増えたときに、ここを直し忘れないため） */
export const REASON_CRITERIA_KEYS = Object.keys(REASON_CRITERIA);
export const ALL_REASONS = REPORT_REASONS;
