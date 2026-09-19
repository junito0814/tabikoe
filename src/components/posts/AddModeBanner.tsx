import Link from "next/link";

/**
 * post-timeline Task4 / add-spots Task2: しおりの追加モードのバナー
 * 出典: docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *       docs/tasks/itinerary/add-spots/02-add-mode.md
 *       要件定義書 v3.0 3.7.4
 *
 * 【初心者向け】`/search?…&itinerary=<id>&day=<n>` で開かれたとき、一覧の上に固定で出す帯。
 * 「〈アルバム名〉 Day n に追加中 [完了]」。「完了」でしおり詳細（/itineraries/[id]）へ戻る。
 * Day が無い（日付なしのタブから来た）ときは「日付なし に追加中」。タイトルが取れなければ「しおり」と出す。
 * state を持たない表示だけの部品なので Server Component からもそのまま使える。
 */
export interface AddModeInfo {
  itineraryId: string;
  /** 1 始まりの Day。null は「日付なし」 */
  day: number | null;
  title: string | null;
  /** そのしおりに既に入っているスポット ID（カードの「＋」を ✓ にする） */
  spotIds: string[];
}

/** URL の itinerary/day → AddModeInfo（day は 1 以上の整数だけ受け付ける） */
export function parseAddModeParams(itinerary: string | null | undefined, day: string | null | undefined, title: string | null = null): AddModeInfo | null {
  if (!itinerary) return null;
  const dayNumber = day ? Number.parseInt(day, 10) : Number.NaN;
  return { itineraryId: itinerary, day: Number.isInteger(dayNumber) && dayNumber >= 1 ? dayNumber : null, title, spotIds: [] };
}

export function addModeDoneHref(info: AddModeInfo): string {
  return `/itineraries/${info.itineraryId}`;
}

export function AddModeBanner({ info }: { info: AddModeInfo }) {
  return (
    <div
      role="status"
      data-add-mode-banner
      className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-[13px] font-semibold text-white"
    >
      <span className="min-w-0 truncate">
        {info.title ?? "しおり"}
        <span className="ml-1.5 font-medium">{info.day === null ? "日付なし" : `Day ${info.day}`} に追加中</span>
      </span>
      <Link href={addModeDoneHref(info)} className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold text-white">
        完了
      </Link>
    </div>
  );
}
