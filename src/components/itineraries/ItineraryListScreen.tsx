"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPeriodLabel } from "@/lib/itineraries/day-utils";
import type { ItineraryListItem } from "@/lib/itineraries/get-itinerary";
import { itineraryGroup, sortItineraries } from "@/lib/itineraries/sort-itineraries";
import { CreateItineraryDialog } from "./CreateItineraryDialog";
import { defaultItineraryApi, type ItineraryApi } from "./itinerary-api";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { PostFab } from "@/components/posts/PostFab";
import { HeartIcon } from "@/components/ui/LineIcons";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * itinerary-basics Task2: しおり一覧（SC-22）
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md
 *       要件定義書 v3.0 3.11.1
 *
 * 【初心者向け】メニューバーの「しおり」から開く。カードは旅行タイトル・期間・スポット数・済み件数だけ（写真は置かない）。
 * 並び順は sort-itineraries.ts（期間が近い順 → 未設定 → 過ぎたもの）。過ぎたものは薄くせず「済」の印を付けて「アルバムを見る」（v3.1）。
 * 先頭には「行きたいスポット」への入口（件数つき。v3.1。マイページの入口も残る）。期間は年つき。
 * 「＋ 新規」→ CreateItineraryDialog → 作成できたら詳細へ。
 */
export function ItineraryListScreen({
  items,
  today,
  wishlistCount = null,
  api = defaultItineraryApi,
}: {
  items: ItineraryListItem[];
  today: string;
  /** v3.1: 先頭の「行きたいスポット」の件数（取れなければ null で件数なし） */
  wishlistCount?: number | null;
  api?: ItineraryApi;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const sorted = sortItineraries(items, today);

  return (
    <PullToRefresh>
      {/* #807: 右下の「＋ ここに投稿」に最後の行が隠れないよう、下に 80px の余白（pb-24） */}
      <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-6 pb-24">
        <div className="w-full max-w-[520px]">
          {/* #693: 画面名は「計画」。中の区切りの見出しが「しおり」になる（決定事項 75） */}
          <header className="mb-4">
            <h1 className="text-[1.125rem] font-bold text-ink">計画</h1>
          </header>

          {/* v3.1: 先頭に「行きたいスポット」への入口 */}
          <Link href="/wishlist?back=%2Fitineraries" className="mb-3 flex items-center justify-between rounded-[12px] border border-line bg-surface p-3 shadow-card" data-wishlist-entry>
            <span className="flex items-center gap-2 text-[0.875rem] font-bold text-ink">
              {/* #713: 絵文字をやめ、線のハートにした（色は「保存」の色のまま） */}
              <span className="text-saved">
                <HeartIcon />
              </span>
              行きたいスポット
              {wishlistCount !== null && <span className="rounded-full bg-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">{wishlistCount}</span>}
            </span>
          </Link>

          {/* #693: 「しおり」の見出しで区切り、「＋ 新規」は作るものの見出しの横に置く（決定事項 75） */}
          <div className="mb-2 mt-5 flex items-center justify-between">
            <h2 className="text-[0.875rem] font-bold text-ink">しおり</h2>
            <button type="button" onClick={() => setIsCreating(true)} className="h-9 rounded-full bg-accent px-4 text-[0.75rem] font-bold text-white">
              ＋ 新規
            </button>
          </div>

          {sorted.length === 0 ? (
            /* #800: 空の画面は同じ部品で（約束 14）。ここは上に「＋ 新規」があるのでボタンは置かない */
            <EmptyState title="しおりがありません" description="「＋ 新規」か、スポットの「＋」から作れます" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {sorted.map((item) => {
                const group = itineraryGroup(item, today);
                const period = formatPeriodLabel(item.startDate, item.endDate);
                return (
                  <li key={item.id} data-itinerary-group={group}>
                    <article className="rounded-[12px] border border-line bg-surface p-3 shadow-card">
                      <Link href={`/itineraries/${item.id}`} prefetch={false} className="flex flex-col gap-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[0.9375rem] font-bold text-ink">{item.title}</span>
                          <span className="flex shrink-0 items-center gap-1 text-[0.6875rem] text-muted">
                            {period}
                            {group === "past" && (
                              <span className="rounded-full bg-done/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-done" data-past-mark>
                                済
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="text-[0.75rem] text-muted">
                          {item.spotCount} スポット
                          {item.dayCount > 0 && ` ・ ${item.dayCount} 日間`}
                          {item.spotCount > 0 && ` ・ ${item.checkedCount}/${item.spotCount} 済`}
                        </span>
                      </Link>
                      {group === "past" && item.hasAlbumPosts && (
                        <Link href={`/albums/${item.tripId}`} className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[0.75rem] font-semibold text-ink">
                          アルバムを見る
                        </Link>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <CreateItineraryDialog
          open={isCreating}
          onClose={() => setIsCreating(false)}
          onSubmit={async (input) => {
            const response = await api.create(input);
            if (response.ok) {
              const data = (await response.json()) as { itineraryId: string };
              router.push(`/itineraries/${data.itineraryId}`);
            }
            return response;
          }}
        />
      </div>
      <PostFab />
    </PullToRefresh>
  );
}
