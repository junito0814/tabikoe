"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";

/**
 * my-page-v3 Task2: 旅行タイトルの付け直しダイアログ
 * 出典: docs/tasks/records/my-page-v3/02-provisional-title-prompt.md
 *       要件定義書 v3.0 3.3.2（仮タイトル「今日の投稿（M/D）」のままの投稿に付け直しを促す）
 *
 * 【初心者向け】PATCH /api/trips/[id]（trip-title Task3）で旅行タイトルを変える。同じ旅行の投稿（アルバム・しおり）全部に反映される。
 */
export function RenameTripDialog({
  open,
  tripId,
  currentTitle,
  onClose,
  onRenamed,
  submit = defaultSubmit,
}: {
  open: boolean;
  tripId: string;
  currentTitle: string;
  onClose: () => void;
  onRenamed: (title: string) => void;
  /** 差し替え口（単体テスト用） */
  submit?: (tripId: string, title: string) => Promise<Response>;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await submit(tripId, next);
      if (response.status === 409) {
        setError("同じタイトルの旅行がすでにあります");
        return;
      }
      if (!response.ok) {
        setError("タイトルを変更できませんでした");
        return;
      }
      onRenamed(next);
      onClose();
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("タイトルを変更できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} title="旅行にタイトルを付ける" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3" data-rename-trip>
        <p className="text-[12px] leading-[1.7] text-muted">
          「{currentTitle}」は仮のタイトルです。旅行の名前を付けると、同じ旅行の投稿がアルバムとしおりにまとまります。
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TRIP_TITLE_LENGTH}
          placeholder="例: 大阪旅行"
          aria-label="旅行タイトル"
          autoFocus
          className="h-11 rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {error && <ErrorNotice message={error} />}
        <button type="submit" disabled={isSubmitting || !title.trim()} className="h-11 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45">
          変更する
        </button>
      </form>
    </Sheet>
  );
}

function defaultSubmit(tripId: string, title: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
}
