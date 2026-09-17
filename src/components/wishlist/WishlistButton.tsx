"use client";

import { useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * F-RC-05 Task3: 「行きたい」保存ボタン
 * 出典: docs/tasks/records/wishlist/03-wishlist-entry-points-ui.md
 *
 * 投稿カード一覧（SC-04）・投稿詳細（SC-05）に組み込む前提の単体コンポーネント。
 * 保存状態は楽観的に切り替え、API失敗時は元に戻す。
 * 保存・取消の両APIは冪等なので、連打や他端末での操作とずれてもサーバ側の状態に収束する。
 */
export function WishlistButton({
  spotId,
  initialSaved,
  onChange,
  submitToggle = defaultSubmitToggle,
  className,
}: {
  spotId: string;
  initialSaved: boolean;
  /** 保存状態が確定した時に呼ぶ（一覧側で件数表示などに使う） */
  onChange?: (saved: boolean) => void;
  /** 差し替え口（単体テスト用） */
  submitToggle?: (spotId: string, save: boolean) => Promise<Response>;
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (isPending) return;
    const next = !saved;
    setIsPending(true);
    setSaved(next);

    try {
      const response = await submitToggle(spotId, next);
      if (!response.ok) {
        setSaved(!next);
        return;
      }
      onChange?.(next);
    } catch (error) {
      setSaved(!next);
      if (error instanceof UnauthorizedError) return;
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "行きたいを解除" : "行きたいに保存"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
        saved
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-ink"
      } ${className ?? ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {saved ? "保存済み" : "行きたい"}
    </button>
  );
}

function defaultSubmitToggle(spotId: string, save: boolean): Promise<Response> {
  if (save) {
    return fetchWithAuthRedirect("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotId }),
    });
  }
  return fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" });
}
