"use client";

import { useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * post-timeline Task2 / wishlist-v3 Task1（前半）: カードの「＋」（保存ボタン）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       docs/tasks/records/wishlist-v3/01-save-sheet.md
 *       要件定義書 v3.0 3.6.4
 *
 * 【初心者向け】投稿カード・スポット別見出し・ピンの吹き出しに置く丸い「＋」。保存済みなら「✓」になる。
 * Phase 12 の時点では「行きたいスポット」への保存・解除だけを行う（既存の /api/wishlist を呼ぶ）。
 * Phase 13（wishlist-v3 Task1）で、押すと「行きたい／しおり」の 2 択シート（SaveSheet）を開く形に広げる。
 * `onPress` を渡すと既定の動きを差し替えられる（追加モード中にしおりへ直接追加する用途）。
 *
 * 保存状態は楽観的に切り替え、API 失敗時は元に戻す（WishlistButton と同じ考え方）。
 */
export function SaveButton({
  spotId,
  initialSaved,
  onPress,
  submitToggle = defaultSubmitToggle,
  size = "md",
  className,
}: {
  spotId: string;
  initialSaved: boolean;
  /** 既定の動き（行きたいの保存・解除）の代わりに呼ぶ */
  onPress?: () => void;
  /** 差し替え口（単体テスト用） */
  submitToggle?: (spotId: string, save: boolean) => Promise<Response>;
  size?: "sm" | "md";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (onPress) {
      onPress();
      return;
    }
    if (isPending) return;
    const next = !saved;
    setIsPending(true);
    setSaved(next);
    try {
      const response = await submitToggle(spotId, next);
      if (!response.ok) setSaved(!next);
    } catch (error) {
      setSaved(!next);
      if (error instanceof UnauthorizedError) return;
    } finally {
      setIsPending(false);
    }
  };

  const dimension = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "保存済み（押すと行きたいを解除）" : "保存する"}
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
        saved ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
      } ${className ?? ""}`}
    >
      {saved ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function defaultSubmitToggle(spotId: string, save: boolean): Promise<Response> {
  return save
    ? fetchWithAuthRedirect("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotId }),
      })
    : fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" });
}
