"use client";

import { useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { SaveSheet, type SaveSheetApi } from "./SaveSheet";
import { isSpotSaved } from "@/lib/save/is-spot-saved";
import { TERMS } from "@/lib/terms";

/**
 * wishlist-v3 Task1 / add-spots Task2: 「＋」（保存ボタン）
 * 出典: docs/tasks/records/wishlist-v3/01-save-sheet.md
 *       docs/tasks/itinerary/add-spots/02-add-mode.md
 *       要件定義書 v3.0 3.6.4・3.11.4
 *
 * 【初心者向け】投稿カード・スポット別見出し・投稿詳細・ピンの吹き出しに置く丸い「＋」。
 *   - 通常: 押すと保存先シート（SaveSheet: 行きたい／しおり）。閉じたら「〈しおり名〉に保存しました [しおりを見る]」のトースト。
 *           保存済み（行きたい or しおり）なら「✓」表示
 *   - 追加モード（addMode）: シートを出さず、そのしおりに直接追加する。入っていれば「✓」で、押すと外れる
 * `onPress` を渡すと既定の動きを差し替えられる（テストや特殊な入口用）。
 */
export interface AddModeTarget {
  itineraryId: string;
  day: number | null;
  /** 既に入っているか */
  initialAdded: boolean;
}

export function SaveButton({
  spotId,
  initialSaved,
  addMode = null,
  onPress,
  api,
  addToItinerary = defaultAddToItinerary,
  removeFromItinerary = defaultRemoveFromItinerary,
  size = "md",
  className,
}: {
  spotId: string;
  /** 行きたいに保存済みか */
  initialSaved: boolean;
  addMode?: AddModeTarget | null;
  onPress?: () => void;
  /** 差し替え口（単体テスト用） */
  api?: SaveSheetApi;
  addToItinerary?: (itineraryId: string, spotId: string, day: number | null) => Promise<Response>;
  removeFromItinerary?: (itineraryId: string, spotId: string) => Promise<Response>;
  size?: "sm" | "md";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [added, setAdded] = useState(addMode?.initialAdded ?? false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const handleClick = async () => {
    if (onPress) {
      onPress();
      return;
    }
    if (addMode) {
      if (isPending) return;
      const next = !added;
      setIsPending(true);
      setAdded(next);
      try {
        const response = next ? await addToItinerary(addMode.itineraryId, spotId, addMode.day) : await removeFromItinerary(addMode.itineraryId, spotId);
        if (!response.ok) setAdded(!next);
      } catch (error) {
        setAdded(!next);
        if (error instanceof UnauthorizedError) return;
      } finally {
        setIsPending(false);
      }
      return;
    }
    setIsSheetOpen(true);
  };

  const isChecked = addMode ? added : saved;
  const dimension = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  // #810: 言葉は「行きたい」に統一（「保存する」「保存済み」とは言わない）
  const label = addMode ? (added ? "しおりに追加済み（押すと外す）" : "しおりに追加") : isChecked ? `${TERMS.wishlist}に入っています（押すと変えられます）` : TERMS.wishlist;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isPending}
        aria-pressed={isChecked}
        aria-label={label}
        data-save-button={addMode ? "add-mode" : "sheet"}
        className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
          isChecked ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
        } ${className ?? ""}`}
      >
        {isChecked ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {!addMode && (
        <SaveSheet
          open={isSheetOpen}
          spotId={spotId}
          initialWishlisted={saved}
          api={api}
          onClose={(result) => {
            setIsSheetOpen(false);
            /*
             * #758（2026-10-06）: ここは `|| saved` で終わっていて、**一度 ✓ になると二度と ＋ に戻らなかった**。
             * 判断は `isSpotSaved`（純粋関数）に切り出した。
             */
            setSaved(isSpotSaved(result.wishlisted, result.inAnyItinerary));
            if (result.savedItinerary) {
              setToast({ text: `${result.savedItinerary.title} に保存しました`, action: { label: "しおりを見る", href: `/itineraries/${result.savedItinerary.id}` } });
            }
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function defaultAddToItinerary(itineraryId: string, spotId: string, day: number | null): Promise<Response> {
  return fetchWithAuthRedirect(`/api/itineraries/${itineraryId}/spots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spotId, dayIndex: day }),
  });
}

function defaultRemoveFromItinerary(itineraryId: string, spotId: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/itineraries/${itineraryId}/spots/${spotId}`, { method: "DELETE" });
}
