"use client";

import { useCallback, useState } from "react";
import { StepUpDialog } from "./StepUpDialog";

/**
 * admin-login Task 7: 重い操作を「6 桁を聞いてからもう一度送る」に包む
 * 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md
 *
 * 【初心者向け】使い方は、画面が持っている送信関数をこれに通すだけ。
 * ```tsx
 * const { submit, dialog } = useStepUp(submitAction);
 * // …画面の中で submit(...) を呼び、最後に {dialog} を描く
 * ```
 * 送った先が「409 step_up_required」を返したら小窓を出し、6 桁が通ったら**同じ引数でもう一度送る**。
 * 呼び出し側から見ると、ふつうに送って結果が返ってくるのと変わらない。
 * だから既存の画面は 1 行の差し替えで済み、書いた理由メモもそのまま残る。
 */
export class StepUpCancelledError extends Error {}

/** 409 の本文が step_up_required かどうか */
async function isStepUpRequired(response: Response): Promise<boolean> {
  if (response.status !== 409) return false;
  const body = (await response.clone().json().catch(() => null)) as { error?: string } | null;
  return body?.error === "step_up_required";
}

export function useStepUp<A extends unknown[]>(submit: (...args: A) => Promise<Response>) {
  // 小窓の結果を待っている間、「待っている人」をここに置く
  const [resolver, setResolver] = useState<((passed: boolean) => void) | null>(null);

  const guarded = useCallback(
    async (...args: A): Promise<Response> => {
      const first = await submit(...args);
      if (!(await isStepUpRequired(first))) return first;

      // 小窓を出して、通るかやめるかが決まるまで待つ
      const passed = await new Promise<boolean>((resolve) => setResolver(() => resolve));
      setResolver(null);
      // やめたときは「失敗」ではないので、専用のエラーで抜ける（画面はエラー文を出さない）
      if (!passed) throw new StepUpCancelledError();
      return submit(...args);
    },
    [submit]
  );

  const dialog = resolver ? <StepUpDialog onDone={(passed) => resolver(passed)} /> : null;

  return { submit: guarded, dialog };
}
