"use client";

import { useEffect, useRef } from "react";
import { dayLabel } from "@/components/itineraries/DayMoveDropdown";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import { spotsInTab, type NumberedSpot } from "@/lib/itineraries/spots-in-tab";
import type { DayTab } from "@/components/itineraries/DayTabs";
import { CARD_ATTRIBUTE, centeredCardIndex, scrollToCard } from "./card-strip";

/**
 * #763（2026-10-06）: 全画面の地図（/map?itinerary=…）のピンを押したときに下に出すカード帯
 * 出典: Issue #763「全画面の地図でピンをタップしたら、下にカードを出す」
 *
 * 【初心者向け】**一覧が画面にあるならその行へ飛ばす。無いならカードを出す。**
 *
 * | 画面 | 一覧 | どうするか |
 * | --- | --- | --- |
 * | しおり詳細の上 1/3 の地図 | ある（下 2/3） | 行へ飛んで光らせる（#761） |
 * | 全画面の地図 | **無い** | ここのカードを出す |
 * | 「近くのスポットを探す」 | 無い | `NearbyVoices` のカード（前からある） |
 *
 * 以前は全画面の地図でピンを押すと**しおり詳細へ戻って**いました。見比べたいときは、
 * そのたびに地図を開き直すことになります。
 *
 * 横スクロール・スナップ・中央のカードの決め方は `card-strip.ts`（探すモードと共通。約束 14）。
 * ピンとカードの並びは `spotsInTab` 1 つから作るので、**3 枚目のカード ＝ 3 本目のピン**がズレません。
 *
 * **「投稿する」は載せません。** 全画面の地図は「どこにあるか、どう回るか」を確かめる場面です。
 * そこで投稿を始めると地図から出ることになり、全画面にした意味が無くなります（投稿は一覧の行の「⋯」から。#753）。
 */
export function ItinerarySpotCards({
  itinerary,
  day,
  activeSpotId,
  onActiveChange,
  onOpen,
}: {
  itinerary: ItineraryDetail;
  day: DayTab;
  /** 今選んでいるスポット（地図のピンを押すとここが変わる） */
  activeSpotId: string | null;
  /** 横にはじいて別のカードが中央に来たとき */
  onActiveChange: (spotId: string | null) => void;
  /** カードを押したとき（しおり詳細のその行へ） */
  onOpen: (spotId: string) => void;
}) {
  const cards = spotsInTab(itinerary, day);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeIndex = cards.findIndex((card) => card.spot.spotId === activeSpotId);
  /*
   * 【初心者向け】外（地図のピン）から選ばれたときだけ、そのカードを中央へ寄せる。
   * 横にはじいて中央が変わったときに寄せ直すと、指の動きと引っぱり合って跳ねます。
   * そこで「最後に寄せたのはどれか」を覚えておき、違うものが選ばれたときだけ動かします。
   */
  const scrolledToRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSpotId || scrolledToRef.current === activeSpotId) return;
    scrolledToRef.current = activeSpotId;
    const index = cards.findIndex((card) => card.spot.spotId === activeSpotId);
    if (index >= 0) scrollToCard(scrollerRef.current, index);
  }, [activeSpotId, cards]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const index = centeredCardIndex(scroller);
    if (index === null) return;
    const spotId = cards[index]?.spot.spotId ?? null;
    if (spotId && spotId !== activeSpotId) {
      scrolledToRef.current = spotId; // 自分で動いた分は寄せ直さない
      onActiveChange(spotId);
    }
  };

  if (cards.length === 0) return null;

  return (
    <section
      aria-label="このしおりのスポット"
      data-itinerary-cards
      className="pointer-events-auto bg-surface px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
    >
      <div ref={scrollerRef} onScroll={handleScroll} className="-mx-4 flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {cards.map((card, index) => (
          <SpotCard key={card.spot.id} card={card} selected={index === activeIndex} onClick={() => onOpen(card.spot.spotId)} />
        ))}
      </div>
    </section>
  );
}

/** カードの中身: 番号・スポット名・メモ・時刻・Day */
function SpotCard({ card, selected, onClick }: { card: NumberedSpot; selected: boolean; onClick: () => void }) {
  const { spot, day, number } = card;
  return (
    <button
      type="button"
      onClick={onClick}
      {...{ [CARD_ATTRIBUTE]: spot.spotId }}
      aria-current={selected ? "true" : undefined}
      className={`flex w-[196px] shrink-0 snap-center flex-col gap-1 rounded-[12px] border p-2.5 text-left ${selected ? "border-accent" : "border-line"} bg-surface`}
    >
      <span className="flex items-center gap-1.5">
        {/* 地図のピンに出ている数字と同じ（spotsInTab が決める） */}
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-on-ink">{number}</span>
        <span className="truncate text-[13px] font-bold text-ink">{spot.name}</span>
      </span>
      {spot.memo && <span className="line-clamp-2 text-[11px] leading-[1.5] text-muted">{spot.memo}</span>}
      <span className="mt-auto flex items-center gap-2 text-[11px] text-muted">
        {/* 時刻は決まっている行だけ。空の行で「──」を出すと、カードが増えるほど意味の無い記号が並ぶ */}
        {spot.arrivalTime && <span className="font-bold text-ink">{spot.arrivalTime}</span>}
        <span>{dayLabel(day)}</span>
      </span>
    </button>
  );
}
