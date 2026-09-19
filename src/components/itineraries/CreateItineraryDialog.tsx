"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { validatePeriod } from "@/lib/itineraries/day-utils";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";

/**
 * itinerary-basics Task2: しおりの新規作成ダイアログ
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md
 *       要件定義書 v3.0 3.11.1（旅行タイトルと期間（任意）で作る。同名のアルバムと同じ旅行 ID でつながる）
 *
 * 【初心者向け】入力は 3 つ（タイトル・開始日・終了日）。期間は両方入れるか両方空。
 * 送信は親の `onSubmit` に任せ、409（同じ旅行にしおりがある）などの文言はここで出す。
 */
export const PERIOD_ERROR_MESSAGES: Record<string, string> = {
  period_incomplete: "開始日と終了日の両方を入力してください",
  period_reversed: "終了日は開始日以降にしてください",
  period_too_long: "期間は 31 日以内にしてください",
  invalid_date: "日付の形式が正しくありません",
};

export function CreateItineraryDialog({
  open,
  onClose,
  onSubmit,
  initialTitle = "",
}: {
  open: boolean;
  onClose: () => void;
  /** 作成 API を呼ぶ。Response をそのまま返す */
  onSubmit: (input: { title: string; startDate: string | null; endDate: string | null }) => Promise<Response>;
  initialTitle?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const period = validatePeriod(startDate, endDate);
    if (!period.ok) {
      setError(PERIOD_ERROR_MESSAGES[period.error] ?? "期間を確認してください");
      return;
    }
    if (!title.trim()) {
      setError("アルバム名を入力してください");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await onSubmit({ title: title.trim(), startDate: period.startDate, endDate: period.endDate });
      if (response.status === 409) {
        setError("この旅行にはすでにしおりがあります");
        return;
      }
      if (response.status === 403) {
        setError("共同アルバムの旅行には、オーナーだけがしおりを作れます");
        return;
      }
      if (!response.ok) {
        setError("しおりを作成できませんでした。時間をおいてお試しください");
        return;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} title="新しいしおり" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3" data-create-itinerary>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
          アルバム
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TRIP_TITLE_LENGTH}
            placeholder="例: 大阪旅行"
            required
            className="h-11 rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <p className="text-[11px] text-muted">同じタイトルのアルバム（投稿のまとまり）とつながります</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            開始日（任意）
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-2 text-[13px] text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            終了日（任意）
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-[10px] border border-line bg-surface px-2 text-[13px] text-ink" />
          </label>
        </div>
        {error && <ErrorNotice message={error} />}
        <button type="submit" disabled={isSubmitting} className="h-11 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45">
          {isSubmitting ? "作成中…" : "作成する"}
        </button>
      </form>
    </Sheet>
  );
}
