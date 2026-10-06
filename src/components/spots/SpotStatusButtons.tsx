"use client";

import { useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { formatStatusLabel, SPOT_STATUS_LABELS, type LatestSpotStatus, type SpotStatus } from "@/lib/spots/format-status-label";
import type { SpotStatusSummary } from "@/lib/spots/status-report";

/**
 * spot-status-report Task2: 投稿詳細の「まだあった／無くなっていた」
 * 出典: docs/tasks/browsing/spot-status-report/02-detail-buttons-and-display.md
 *       要件定義書 v3.0 3.5.5
 *
 * 【初心者向け】「この場所、まだありますか？」の下に 2 つのボタン。自分の報告は選択状態（aria-pressed）で見せ、
 * 押すと PUT /api/spots/[id]/status を呼んで即時に反映する（1 人 1 件、上書き）。
 * 最新の報告は「9月にまだあった」「8月に無くなっていたとの報告」の形で表示（format-status-label.ts）。
 * 失敗したら元に戻して短い案内を出す。
 */
export function SpotStatusButtons({
  spotId,
  initial,
  submit = defaultSubmit,
  className,
}: {
  spotId: string;
  initial: SpotStatusSummary;
  /** 差し替え口（単体テスト用） */
  submit?: (spotId: string, status: SpotStatus) => Promise<SpotStatusSummary>;
  className?: string;
}) {
  const [summary, setSummary] = useState<SpotStatusSummary>(initial);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestLabel = formatStatusLabel(summary.latest);

  const report = async (status: SpotStatus) => {
    if (isPending) return;
    const previous = summary;
    const optimistic: LatestSpotStatus = { status, reportedAt: new Date().toISOString() };
    setSummary({ latest: optimistic, mine: optimistic });
    setIsPending(true);
    setError(null);
    try {
      setSummary(await submit(spotId, status));
    } catch (caught) {
      setSummary(previous);
      if (caught instanceof UnauthorizedError) return;
      setError(caught instanceof RateLimitedError ? "報告が多すぎます。時間をおいてお試しください" : "報告できませんでした。時間をおいてお試しください");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`} data-spot-status-buttons>
      <p className="text-[0.8125rem] font-semibold text-ink">この場所、まだありますか？</p>
      <div className="flex flex-wrap gap-2">
        {(["still_there", "gone"] as const).map((status) => {
          const selected = summary.mine?.status === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => void report(status)}
              disabled={isPending}
              aria-pressed={selected}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.75rem] font-semibold disabled:opacity-60 ${
                selected
                  ? status === "still_there"
                    ? "border-done bg-done text-white"
                    : "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface text-ink"
              }`}
            >
              <span aria-hidden>{status === "still_there" ? "👍" : "👎"}</span>
              {SPOT_STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>
      {latestLabel && (
        <p className="text-[0.75rem] text-done" data-spot-status>
          {latestLabel}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[0.75rem] text-saved">
          {error}
        </p>
      )}
    </div>
  );
}

class RateLimitedError extends Error {}

async function defaultSubmit(spotId: string, status: SpotStatus): Promise<SpotStatusSummary> {
  const response = await fetchWithAuthRedirect(`/api/spots/${spotId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (response.status === 429) throw new RateLimitedError("rate_limited");
  if (!response.ok) throw new Error(`Failed to report status: ${response.status}`);
  return (await response.json()) as SpotStatusSummary;
}
