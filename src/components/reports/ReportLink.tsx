import Link from "next/link";
import type { ReportTargetType } from "@/lib/reports/constants";
import { buildReportHref } from "./report-href";

/**
 * F-SF-01 Task2: 各画面からの通報導線
 * 出典: docs/tasks/safety/reporting/02-report-screen-ui.md
 *
 * 投稿詳細・コメント・プロフィール・スポット・アルバムの各画面に置く。
 * 自分自身のコンテンツには表示しないこと（呼び出し側の責務。APIでも400で弾く）。
 */
export function ReportLink({
  targetType,
  targetId,
  returnTo,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  returnTo?: string;
  className?: string;
}) {
  return (
    <Link
      href={buildReportHref({ targetType, targetId, returnTo })}
      className={`tap-target text-[0.8125rem] font-medium text-muted underline underline-offset-2 ${className ?? ""}`}
    >
      通報する
    </Link>
  );
}
