"use client";

import { useState } from "react";
import Link from "next/link";
import { appendBackHref } from "@/lib/search/list-state";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ItineraryPickerSheet } from "@/components/save/ItineraryPickerSheet";
import type { SaveSheetApi } from "@/components/save/SaveSheet";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { WishlistItem } from "@/lib/wishlist/constants";
import type { WishlistView } from "@/lib/wishlist/wishlist-view";
import { MapScreen } from "@/components/map/MapScreen";
import { resolveMapOpen } from "@/components/map/map-navigation";

/**
 * F-RC-05 Task2 / wishlist-v3 Task2（v3.0）: 「行きたい」（SC-08。一覧／地図の切替）
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 *       docs/tasks/records/wishlist-v3/02-wishlist-list-map-toggle.md
 *       要件定義書 v3.0 3.6.4
 *
 * 【初心者向け】マイページの「行きたい」から開く。上部の「一覧／地図」で切り替え、状態は URL（?view=map）に持つ。
 *   - 一覧: スポット単位（スポット名・代表写真またはプレースホルダ・都道府県・投稿件数・入っているしおりと Day）。押すとスポット別一覧
 *     各行の「＋」→ しおりと Day を選ぶシート（ItineraryPickerSheet）。追加しても行きたいからは消えない。ゴミ箱マークで行きたいから外す（v3.1）
 *   - 地図: 同じ地図（MapScreen）を「保存済みのピンだけ」で開く。ピンの吹き出しにも「＋」がある
 */
export function WishlistScreen({
  initialItems,
  initialView = "list",
  submitRemove = defaultSubmitRemove,
  saveSheetApi,
  back = null,
}: {
  initialItems: WishlistItem[];
  /** Bug #471: 直前の画面（`?back=` から page.tsx が解決）。無ければ既定の戻り先 */
  back?: { href: string; label: string } | null;
  initialView?: WishlistView;
  /** 差し替え口（単体テスト用） */
  submitRemove?: (spotId: string) => Promise<Response>;
  /** 差し替え口（単体テスト用） */
  saveSheetApi?: SaveSheetApi;
}) {
  const router = useRouter();
  const [view, setView] = useState<WishlistView>(initialView);
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickerSpot, setPickerSpot] = useState<WishlistItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Bug #471: ここから開く画面（スポット別一覧・地図の吹き出し）に「行きたいへ戻る」を渡す
  const selfHref = appendBackHref(view === "map" ? "/wishlist?view=map" : "/wishlist", back?.href);

  const changeView = (next: WishlistView) => {
    setView(next);
    router.replace(appendBackHref(next === "map" ? "/wishlist?view=map" : "/wishlist", back?.href), { scroll: false });
  };

  const handleRemove = async (spotId: string) => {
    if (pendingId) return;
    setPendingId(spotId);
    setErrorMessage(null);
    try {
      const response = await submitRemove(spotId);
      if (!response.ok) {
        setErrorMessage("保存を解除できませんでした");
        return;
      }
      setItems((current) => current.filter((item) => item.spotId !== spotId));
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("保存を解除できませんでした");
    } finally {
      setPendingId(null);
    }
  };

  const header = (
    <header className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Link href={back?.href ?? "/mypage"} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back?.label ?? "マイページ"}
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">行きたい</h1>
        <span className="shrink-0 text-[12px] text-muted">{items.length}件</span>
      </div>
      <div role="radiogroup" aria-label="表示" className="inline-flex w-fit rounded-full border border-line bg-surface p-0.5">
        {(["list", "map"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={view === option}
            onClick={() => view !== option && changeView(option)}
            className={`h-7 rounded-full px-3 text-[12px] font-semibold ${view === option ? "bg-ink text-on-ink" : "text-muted"}`}
          >
            {option === "list" ? "一覧" : "地図"}
          </button>
        ))}
      </div>
    </header>
  );

  if (view === "map") {
    return (
      <div className="flex min-h-screen flex-col bg-app">
        <div className="px-4 pt-4 pb-2">{header}</div>
        <MapScreen open={{ ...resolveMapOpen({}), savedOnly: true, back: back ?? { href: "/mypage", label: "マイページ" } }} selfHref={selfHref} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-4 pb-8">
      <div className="w-full max-w-[520px]">
        {header}
        {items.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted">まだ「行きたい」スポットはありません</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.spotId} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-2.5" data-wishlist-item={item.spotId}>
                <Link href={appendBackHref(`/spots/${item.spotId}`, selfHref)} className="flex min-w-0 flex-1 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnailUrl}
                    alt={item.hasPost ? `${item.name}の写真` : "投稿がないスポット"}
                    data-placeholder={item.hasPost ? undefined : "true"}
                    className="h-16 w-16 shrink-0 rounded-[8px] object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {item.prefecture ?? "都道府県未設定"} ・ {item.postCount > 0 ? `投稿 ${item.postCount} 件` : "投稿なし"}
                      {item.itineraries.map((it) => (
                        <span key={it.id} className="ml-1 text-accent">
                          ・ {it.title}
                          {it.dayIndex !== null && ` Day ${it.dayIndex}`}
                        </span>
                      ))}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPickerSpot(item)}
                  aria-label={`${item.name}をしおりへ`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
                {/* v3.1（mentoring-7 Task1）: 「解除」の文字ではなくゴミ箱マーク。読み上げ用の名前は aria-label に残す */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.spotId)}
                  disabled={pendingId !== null}
                  aria-label={`${item.name}の保存を解除`}
                  title="行きたいから外す"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-saved disabled:opacity-45"
                >
                  {pendingId === item.spotId ? (
                    <span className="text-[11px]">…</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {errorMessage && <ErrorNotice className="mt-3" message={errorMessage} />}
      </div>

      {pickerSpot && (
        <ItineraryPickerSheet
          open
          spotId={pickerSpot.spotId}
          spotName={pickerSpot.name}
          api={saveSheetApi}
          onClose={(result) => {
            setPickerSpot(null);
            if (result.savedItinerary) {
              setToast({ text: `${result.savedItinerary.title} に保存しました`, action: { label: "しおりを見る", href: `/itineraries/${result.savedItinerary.id}` } });
              router.refresh();
            }
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function defaultSubmitRemove(spotId: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" });
}
