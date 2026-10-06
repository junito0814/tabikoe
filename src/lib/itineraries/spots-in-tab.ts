import { daysInTab, type DayKey, type DayTab } from "@/lib/itineraries/day-tabs";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";
import { orderSpots } from "@/lib/itineraries/order-spots";

/**
 * #763（2026-10-06）: 「今のタブに出すスポットを、出す順に番号つきで並べる」ただ 1 つの判断
 * 出典: Issue #763「全画面の地図でピンをタップしたら、下にカードを出す」
 *
 * 【初心者向け】全画面の地図では、**地図のピンと下のカードが 1 対 1 で対応**していなければ
 * なりません（3 枚目のカードを見ているときに大きくなるのは 3 本目のピン）。
 * 並べ方を 2 か所に書くと、片方だけ直したときに静かにズレます（約束 13・14）。
 * そこで「どの Day を どの順で、何番として出すか」はここ 1 つに置き、
 * ピン（`buildItineraryPins`）もカード（`ItinerarySpotCards`）もここから作ります。
 */
export interface NumberedSpot {
  spot: ItinerarySpotItem;
  /** 属している Day（null＝日付なし） */
  day: DayKey;
  /** その Day の中での順番（1 始まり）。ピンに出る数字と同じ */
  number: number;
}

export function spotsInTab(itinerary: ItineraryDetail, tab: DayTab): NumberedSpot[] {
  return daysInTab(tab, itinerary.dayCount).flatMap((day) =>
    orderSpots(itinerary.spots.filter((spot) => spot.dayIndex === day)).map((spot, index) => ({ spot, day, number: index + 1 }))
  );
}
