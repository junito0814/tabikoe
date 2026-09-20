"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { validatePeriod } from "@/lib/itineraries/day-utils";
import { PERIOD_ERROR_MESSAGES } from "./CreateItineraryDialog";

/**
 * itinerary-days Task2: 「期間を変更」ダイアログ
 * 出典: docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *
 * 【初心者向け】開始日・終了日の 2 つ。両方空にして保存すると期間解除（全スポットが未定へ）。
 * 縮めると消える Day のスポットは未定に残る（消えない）と案内する。
 */
export function PeriodDialog({
  open,
  startDate,
  endDate,
  onClose,
  onSubmit,
}: {
  open: boolean;
  startDate: string | null;
  endDate: string | null;
  onClose: () => void;
  onSubmit: (startDate: string | null, endDate: string | null) => Promise<Response>;
}) {
  const [start, setStart] = useState(startDate ?? "");
  const [end, setEnd] = useState(endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const period = validatePeriod(start, end);
    if (!period.ok) {
      setError(PERIOD_ERROR_MESSAGES[period.error] ?? "期間を確認してください");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await onSubmit(period.startDate, period.endDate);
      if (response.status === 403) {
        setError("期間を変更できるのはオーナーだけです");
        return;
      }
      if (!response.ok) {
        setError("期間を保存できませんでした");
        return;
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} title="期間を変更" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3" data-period-dialog>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            開始日
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-2 text-[13px] text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            終了日
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-2 text-[13px] text-ink" />
          </label>
        </div>
        <p className="text-[11px] leading-[1.6] text-muted">期間を短くすると、消える日のスポットは「日付なし」に移ります（消えません）。両方空にすると期間を解除します。</p>
        {error && <ErrorNotice message={error} />}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
            className="text-[12px] font-medium text-muted underline underline-offset-2"
          >
            期間を解除
          </button>
          <button type="submit" disabled={isSubmitting} className="h-10 rounded-[10px] bg-ink px-4 text-[13px] font-semibold text-on-ink disabled:opacity-45">
            保存
          </button>
        </div>
      </form>
    </Sheet>
  );
}
