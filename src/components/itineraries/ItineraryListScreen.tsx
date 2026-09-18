"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDayLabel } from "@/lib/itineraries/day-utils";
import type { ItineraryListItem } from "@/lib/itineraries/get-itinerary";
import { itineraryGroup, sortItineraries } from "@/lib/itineraries/sort-itineraries";
import { CreateItineraryDialog } from "./CreateItineraryDialog";
import { defaultItineraryApi, type ItineraryApi } from "./itinerary-api";

/**
 * itinerary-basics Task2: しおり一覧（SC-22）
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md
 *       要件定義書 v3.0 3.11.1
 *
 * 【初心者向け】メニューバーの「しおり」から開く。カードは旅行タイトル・期間・スポット数・済み件数だけ（写真は置かない）。
 * 並び順は sort-itineraries.ts（期間が近い順 → 未設定 → 過ぎたもの）。過ぎたものは薄く表示して「アルバムを見る」。
 * 「＋ 新規」→ CreateItineraryDialog → 作成できたら詳細へ。
 */
export function ItineraryListScreen({ items, today, api = defaultItineraryApi }: { items: ItineraryListItem[]; today: string; api?: ItineraryApi }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const sorted = sortItineraries(items, today);

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="w-full max-w-[520px]">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-ink">しおり</h1>
          <button type="button" onClick={() => setIsCreating(true)} className="h-9 rounded-full bg-accent px-4 text-[12px] font-bold text-white">
            ＋ 新規
          </button>
        </header>

        {sorted.length === 0 ? (
          <div className="py-16 text-center text-[13px] leading-[1.8] text-muted">
            しおりがありません
            <br />
            「＋ 新規」か、投稿一覧の「＋」から作れます
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sorted.map((item) => {
              const group = itineraryGroup(item, today);
              const period =
                item.startDate && item.endDate ? `${formatDayLabel(item.startDate)} 〜 ${formatDayLabel(item.endDate)}${group === "past" ? "（済）" : ""}` : "期間未設定";
              return (
                <li key={item.id} data-itinerary-group={group} className={group === "past" ? "opacity-60" : ""}>
                  <article className="rounded-[12px] border border-line bg-surface p-3 shadow-card">
                    <Link href={`/itineraries/${item.id}`} className="flex flex-col gap-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-bold text-ink">{item.title}</span>
                        <span className="shrink-0 text-[11px] text-muted">{period}</span>
                      </span>
                      <span className="text-[12px] text-muted">
                        {item.spotCount} スポット
                        {item.dayCount > 0 && ` ・ ${item.dayCount} 日間`}
                        {item.spotCount > 0 && ` ・ ${item.checkedCount}/${item.spotCount} 済`}
                      </span>
                    </Link>
                    {group === "past" && item.hasAlbumPosts && (
                      <Link href={`/albums/${item.tripId}`} className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
                        📷 アルバムを見る
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
  );
}
