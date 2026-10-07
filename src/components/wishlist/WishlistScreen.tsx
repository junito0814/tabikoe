"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/layout/BackLink";
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
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { LIST_SORTS, listSortLabel, type ListSort } from "@/lib/records/list-sort";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";

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
  sort = "newest",
  submitRemove = defaultSubmitRemove,
  saveSheetApi,
  back = null,
}: {
  initialItems: WishlistItem[];
  /** Bug #471: 直前の画面（`?back=` から page.tsx が解決）。無ければ既定の戻り先 */
  back?: { href: string; label: string } | null;
  initialView?: WishlistView;
  /** #797: 並び順（アルバム一覧と同じ。既定は新着順） */
  sort?: ListSort;
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

  /*
   * #797（2026-10-06）: 表示（一覧／地図）と並び順は**どちらも URL に持つ**。
   * 【初心者向け】並び順だけを state に持つと、地図に切り替えて戻ったときに消えます。
   * URL に入れておけば、戻っても・共有しても同じ並びで開けます。
   */
  const hrefFor = (nextView: WishlistView, nextSort: ListSort) => {
    const params = new URLSearchParams();
    if (nextView === "map") params.set("view", "map");
    if (nextSort !== "newest") params.set("sort", nextSort);
    const query = params.toString();
    return appendBackHref(`/wishlist${query ? `?${query}` : ""}`, back?.href);
  };

  const changeView = (next: WishlistView) => {
    setView(next);
    router.replace(hrefFor(next, sort), { scroll: false });
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
    /*
      * #797（2026-10-06）: 見出しをアルバム・投稿履歴と同じ形にした（**上に戻る、下に大きなタイトル**）。
      * 以前はここだけ「戻る・中央のタイトル・右に件数」が 1 行で、3 画面で形が違っていた。
      */
    <header className="flex flex-col gap-2">
      <BackLink href={back?.href ?? "/mypage"} label={back?.label ?? "マイページ"} />
      <div className="flex items-baseline gap-2">
        <h1 className="flex-1 text-[1.125rem] font-bold text-ink">行きたい</h1>
        <span className="text-[0.75rem] text-muted">{items.length} 件</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="表示" className="inline-flex w-fit rounded-full border border-line bg-surface p-0.5">
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={view === option}
              onClick={() => view !== option && changeView(option)}
              className={`tap-target h-7 rounded-full px-3 text-[0.75rem] font-semibold ${view === option ? "bg-ink text-on-ink" : "text-muted"}`}
            >
              {option === "list" ? "一覧" : "地図"}
            </button>
          ))}
        </div>
        {/* #797: 置き場所は投稿履歴の「すべてのアルバム」と同じ（切替の右） */}
        <Select<ListSort>
          value={sort}
          onChange={(next) => router.replace(hrefFor(view, next), { scroll: false })}
          options={LIST_SORTS}
          label={(option) => listSortLabel(option, "保存")}
          ariaLabel="並び順"
        />
      </div>
    </header>
  );

  if (view === "map") {
    return (
      <div className="flex min-h-screen flex-col bg-app">
        <div className="px-4 pt-4 pb-2">{header}</div>
        {/* #788: 見出しに戻るがあるので、地図の上の戻るは出さない（同じものが 2 つ出ていた） */}
        <MapScreen open={{ ...resolveMapOpen({}), savedOnly: true, back: back ?? { href: "/mypage", label: "マイページ" } }} selfHref={selfHref} hideBack />
      </div>
    );
  }

  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-4 pb-8">
        <div className="w-full max-w-[520px]">
          {header}
          {items.length === 0 ? (
            /* #800: 空のときに「次の一手」を 1 つ置く */
            <EmptyState
              title="まだ「行きたい」スポットはありません"
              description="気になるスポットの「＋」で、ここに貯まります"
              action={{ label: "スポットを探す", href: "/" }}
            />
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.spotId} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-2.5" data-wishlist-item={item.spotId}>
                  <Link href={appendBackHref(`/spots/${item.spotId}`, selfHref)} prefetch={false} className="flex min-w-0 flex-1 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.hasPost ? `${item.name}の写真` : "投稿がないスポット"}
                      data-placeholder={item.hasPost ? undefined : "true"}
                      className="h-16 w-16 shrink-0 rounded-[8px] object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{item.name}</span>
                      {/*
                        * #790（2026-10-06）: しおり名を**別の行**にした。
                        *
                        * 【初心者向け】以前は「東京都 ・ 投稿 1 件 ・ 〈しおり名〉 Day 1」を 1 行に詰めていて、
                        * 390px に入りきらず**しおり名が単語の途中で次の行に落ちて**いた。
                        * 1 行目は場所の話、2 行目はしおりの話、と分けると切れない。
                        * 長い名前は 2 行目だけ「…」で省く（`truncate`）。
                        */}
                      <span className="mt-0.5 block text-[0.6875rem] text-muted">
                        {item.prefecture ?? "都道府県未設定"} ・ {item.postCount > 0 ? `投稿 ${item.postCount} 件` : "投稿なし"}
                      </span>
                      {item.itineraries.length > 0 && (
                        <span className="mt-0.5 block truncate text-[0.6875rem] text-accent" data-wishlist-itineraries>
                          {item.itineraries
                            .map((it) => (it.dayIndex !== null ? `Day ${it.dayIndex} ・ ${it.title}` : it.title))
                            .join(" ／ ")}
                        </span>
                      )}
                    </span>
                  </Link>
                  {/*
                    * #745: しおりに入っていれば ✓、入っていなければ ＋。
                    *
                    * 【初心者向け】決定事項 76 は「行きたい・しおりのどれかに入っていれば ✓」だが、
                    * **この画面は全部が「行きたい」に入っている**ので、それをそのまま当てると全部 ✓ に
                    * なって意味がない。ここで知りたいのは「**しおりに入れたか**」。
                    */}
                  <button
                    type="button"
                    onClick={() => setPickerSpot(item)}
                    aria-pressed={item.itineraries.length > 0}
                    aria-label={item.itineraries.length > 0 ? `${item.name}はしおりに入っています（押すと変えられます）` : `${item.name}をしおりへ`}
                    data-itinerary-saved={item.itineraries.length > 0 ? "true" : undefined}
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      item.itineraries.length > 0 ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
                    }`}
                  >
                    {item.itineraries.length > 0 ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    )}
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
                      <span className="text-[0.6875rem]">…</span>
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
              const spotId = pickerSpot.spotId;
              setPickerSpot(null);
              const saved = result.savedItinerary;
              /*
               * #745: 押した瞬間に ✓ にする（要件 4.5.11 の場面 3）。
               * `router.refresh()` の戻りを待つと、1 往復のあいだ「＋」のままに見える。
               *
               * #864（2026-10-07）: ここは**追加したときしか見ていなかった**ので、
               * しおりから**外しても ✓ のまま**だった（`savedItinerary` は外したときは null）。
               * シートが返す `inAnyItinerary`（どれかのしおりに入っているか）で、どちらの向きにも直す。
               */
              setItems((current) =>
                current.map((item) => {
                  if (item.spotId !== spotId) return item;
                  if (saved && !item.itineraries.some((it) => it.id === saved.id)) {
                    return { ...item, itineraries: [...item.itineraries, { id: saved.id, title: saved.title, dayIndex: null }] };
                  }
                  // どのしおりにも入っていないなら、行の下の「〈しおり名〉 Day 1」も消す
                  if (!result.inAnyItinerary) return { ...item, itineraries: [] };
                  return item;
                })
              );
              if (saved) {
                setToast({ text: `${saved.title} に保存しました`, action: { label: "しおりを見る", href: `/itineraries/${saved.id}` } });
              }
              // 外したときも取り直す（どのしおりが残ったかはサーバーが正）
              router.refresh();
            }}
          />
        )}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </PullToRefresh>
  );
}

function defaultSubmitRemove(spotId: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" });
}
