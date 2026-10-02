"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { appendBackHref } from "@/lib/search/list-state";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { NearbyPost } from "@/lib/posts/nearby-posts";
import { DEFAULT_TRAVEL_MODE, formatTravelMinutes, TRAVEL_MODE_LABELS, TRAVEL_MODES, type TravelMode } from "@/lib/geo/travel-time";
import {
  activeSpotFilterCount,
  EMPTY_SPOT_FILTERS,
  hasActiveSpotFilters,
  spotFiltersToParams,
  type SpotFilters,
} from "@/lib/map/spot-aggregate";
import type { PostCategory, PostDuration } from "@/lib/posts/constants";
import type { CostRange } from "@/lib/posts/search-posts";
import { FilterSheet } from "@/components/posts/FilterSheet";

export type FetchNearbyPosts = (center: { lat: number; lng: number }, mode: TravelMode, filters: SpotFilters) => Promise<NearbyPost[]>;

/**
 * explore-mode Task 4: 絞り込みシートに渡す形。
 *
 * 【初心者向け】シート（`FilterSheet`）は投稿一覧でも使うので、こちらの言葉（`minRating`）ではなく
 * シートの言葉（`rating`）で渡す。入れたものと同じ形が返ってくるので、変換はこのファイルの
 * `toSheet`／`fromSheet` の 2 か所だけに閉じる。
 */
interface SpotSheetValue {
  categories: readonly PostCategory[];
  cost: CostRange | null;
  duration: PostDuration | null;
  rating: number | null;
  manualOnly: boolean;
}

function toSheet(filters: SpotFilters): SpotSheetValue {
  return { categories: filters.categories, cost: filters.cost, duration: filters.duration, rating: filters.minRating, manualOnly: filters.manualOnly };
}

function fromSheet(value: SpotSheetValue): SpotFilters {
  return { categories: value.categories, cost: value.cost, duration: value.duration, minRating: value.rating, manualOnly: value.manualOnly };
}

/**
 * explore-mode Task2: 「近くのスポット」（探すモードの下 1/3。v3.1 で「近くの声」から改称）
 * 出典: docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.5
 *
 * 【初心者向け】現在地を中心に、近い順のカードを横スクロールで並べる。
 *   - 「移動手段 ▾」（徒歩 1km／自転車 3km／車 10km。v3.2 feedback-0919 Task7）を切り替えると API を呼び直し、分数の表示も変わる
 *   - 横スクロールで真ん中に来たカード（`scroll-snap` で 1 枚ずつ止まる）を親に知らせ、地図の対応ピンを強調する（onActiveChange）
 *   - カードのタップで投稿詳細（/posts/[id]）
 * スクロール位置 → どのカードが中央か、は `scrollLeft / カード幅` で概算する（カード幅は固定）。
 */
/**
 * 横スクロール領域の中央にいちばん近いカードの番号（Bug #503。単体テストの対象）。
 * 【初心者向け】`getBoundingClientRect()` は画面上の実際の位置を返す。カードの中心と、スクロール領域の中心の
 * 距離をくらべていちばん近いものを選ぶ。カードの幅・隙間・余白が変わっても、端まで送っても正しく決まる。
 */
/** 指定した番号のカードを中央へ寄せる（map-restore Task1） */
export function scrollToCard(scroller: HTMLElement | null, index: number): void {
  const card = scroller?.querySelectorAll<HTMLElement>("[data-nearby-card]")[index];
  // jsdom には scrollIntoView が無いので、あるときだけ呼ぶ
  card?.scrollIntoView?.({ block: "nearest", inline: "center" });
}

export function centeredCardIndex(scroller: Pick<HTMLElement, "getBoundingClientRect"> & { querySelectorAll: HTMLElement["querySelectorAll"] }): number | null {
  const cards = Array.from(scroller.querySelectorAll<HTMLElement>("[data-nearby-card]"));
  if (cards.length === 0) return null;
  const box = scroller.getBoundingClientRect();
  const center = box.left + box.width / 2;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function NearbyVoices({
  center,
  fetchPosts = defaultFetchNearbyPosts,
  onActiveChange,
  onPostsLoaded,
  initialMode = DEFAULT_TRAVEL_MODE,
  onModeChange,
  initialActiveSpotId = null,
  backHref = null,
  filters = EMPTY_SPOT_FILTERS,
  onFiltersChange,
}: {
  center: { lat: number; lng: number };
  /** Bug #471: 投稿詳細から「← 地図」で探すモードに戻れるように渡す、この地図の URL */
  backHref?: string | null;
  fetchPosts?: FetchNearbyPosts;
  /** 中央に来たカードの投稿（ピンの強調用）。無ければ null */
  onActiveChange?: (post: NearbyPost | null) => void;
  onPostsLoaded?: (posts: NearbyPost[]) => void;
  initialMode?: TravelMode;
  /** v3.1: 移動手段を切り替えたとき（地図の状態の保存用） */
  onModeChange?: (mode: TravelMode) => void;
  /** map-restore Task1（2026-09-25）: 詳細から戻ったとき、最初に中央に置くカードのスポット */
  initialActiveSpotId?: string | null;
  /** explore-mode Task 4: いま効いている絞り込み（親＝MapScreen が URL と地図の状態に持つ） */
  filters?: SpotFilters;
  /** explore-mode Task 4: 絞り込みを変えたとき（ピンも取り直すので親が受ける） */
  onFiltersChange?: (next: SpotFilters) => void;
}) {
  const [mode, setMode] = useState<TravelMode>(initialMode);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [posts, setPosts] = useState<NearbyPost[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /*
   * loading-feedback Task 4-2（2026-10-02）: 移動手段を変えた直後に古い結果を残さない。
   *
   * 【初心者向け】以前は「取得中」の旗を持たず `posts` だけを見ていたので、徒歩から車に変えても
   * **新しい結果が届くまで古いカードと古い分数が残っていた**。見ている人には「変わっていない」
   * ように映る（分数だけが後から入れ替わるので、誤読もする）。
   *
   * 旗を立てる代わりに「**どの条件で取り終えたか**」を覚えて、いまの条件と見比べる。
   * 効果（useEffect）の中で旗を立てると eslint（react-hooks/set-state-in-effect）に
   * 止められるため、あしあとの地図（Task 2）と同じこのやり方に揃えている。
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  /*
   * いまの条件。中身が同じなら同じ文字になる（`center` は親が作り直すことがあるので値で見る）。
   * explore-mode Task 4: 絞り込みも鍵に混ぜる。変えた直後に古いカードが残らない
   */
  const filterKey = spotFiltersToParams(filters)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const currentKey = `${center.lat},${center.lng},${mode},${filterKey}`;
  /** 絞り込みが効いているか（ボタンの色・0 件の文言の出し分け） */
  const isActive = hasActiveSpotFilters(filters);
  /** 取り終えてもいない・失敗してもいない＝まだ取っている */
  const isFetching = loadedFor !== currentKey && failedFor !== currentKey;
  const failed = failedFor === currentKey;
  /** 条件が変わった直後は古い結果を使わない（これが「前の結果を捨てる」の実体） */
  const visiblePosts = loadedFor === currentKey ? posts : null;
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  const onPostsLoadedRef = useRef(onPostsLoaded);
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
    onPostsLoadedRef.current = onPostsLoaded;
  }, [onActiveChange, onPostsLoaded]);

  // map-restore Task1: 詳細から戻ったときに中央へ戻すカード。
  // Bug #511: 戻ったときは現在地を取り直すため一覧を 2 回取る。どちらの取得でも同じカードを選べるよう、
  // 利用者が操作する（スライド・タップ・移動手段の変更）まで覚えておく
  const restoreSpotRef = useRef<string | null>(initialActiveSpotId);

  useEffect(() => {
    let cancelled = false;
    // 取り終えたときに「どの条件のぶんか」を記録するため、効果の中でも同じ文字を作る
    const key = `${center.lat},${center.lng},${mode},${filterKey}`;
    fetchPosts(center, mode, filters)
      .then((result) => {
        if (cancelled) return;
        setPosts(result);
        setLoadedFor(key);
        const restoreIndex = restoreSpotRef.current ? result.findIndex((post) => post.spotId === restoreSpotRef.current) : -1;

        const index = restoreIndex >= 0 ? restoreIndex : 0;
        setActiveIndex(index);
        onPostsLoadedRef.current?.(result);
        onActiveChangeRef.current?.(result[index] ?? null);
        // 描画が終わってからそのカードへ寄せる（scrollTo は次の描画を待つ必要がある）
        if (index > 0) requestAnimationFrame(() => scrollToCard(scrollerRef.current, index));
      })
      .catch((error) => {
        if (cancelled || error instanceof UnauthorizedError) return;
        setFailedFor(key);
      });
    return () => {
      cancelled = true;
    };
    // filters は filterKey（中身を並べた文字）で見る。同じ中身の作り直しで取り直さないため
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, mode, fetchPosts, filterKey]);

  /**
   * Task3（2026-09-25）: カードのタップは 2 段階。
   * 【初心者向け】選ばれていないカードは「選ぶ」だけ（中央へ寄せ、親が地図を動かして吹き出しを出す）。
   * 選ばれている（中央の）カードをもう一度押すと、そのスポットの投稿一覧へ移る。
   * 地図で場所を確かめてから開けるので、押し間違いで画面が変わらない。
   */
  const selectOrOpen = (index: number) => {
    const post = posts?.[index];
    if (!post) return;
    restoreSpotRef.current = null; // 利用者が選んだら、復元の指定は忘れる
    if (index === activeIndex) {
      router.push(appendBackHref(`/spots/${post.spotId}`, backHref));
      return;
    }
    setActiveIndex(index);
    onActiveChangeRef.current?.(post);
    scrollToCard(scrollerRef.current, index);
  };

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !posts) return;
    // Bug #503: スクロール量からの概算（scrollLeft ÷ カード幅）だと snap-center や左右の余白とずれ、
    // 右端まで送っても最後のカードが選ばれなかった。各カードの実際の位置を測って中央に最も近いものを選ぶ
    const index = centeredCardIndex(scroller);
    if (index !== null && index !== activeIndex) {
      restoreSpotRef.current = null; // 利用者がスライドしたら、復元の指定は忘れる
      setActiveIndex(index);
      onActiveChangeRef.current?.(posts[index] ?? null);
    }
  };

  return (
    <section aria-label="近くのスポット" data-nearby-voices className="flex h-full flex-col gap-2 bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {/*
        * explore-mode Task 4（2026-10-02）: 見出しの行は「近くのスポット ─ 移動手段 ▾ ─ 絞り込み」。
        * 移動手段の横の「移動手段」の文字は外した（選んでいる手段が見えるので要らない）。
        * 読み上げには <select> の aria-label が残るので意味は失わない。
        * 絞り込みは**絵だけ**のボタンにし、効いているときだけ色と数を変える（文字を増やさない）。
        */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-ink">近くのスポット</h2>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="移動手段"
            value={mode}
            onChange={(event) => {
              const next = event.target.value as TravelMode;
              restoreSpotRef.current = null; // 移動手段を変えたら、復元の指定は忘れる
              setMode(next);
              onModeChange?.(next);
            }}
            className="h-8 rounded-full border border-line bg-surface px-2 text-[12px] font-semibold text-ink"
          >
            {TRAVEL_MODES.map((option) => (
              <option key={option} value={option}>
                {TRAVEL_MODE_LABELS[option]}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="絞り込み"
            aria-expanded={isSheetOpen}
            onClick={() => setIsSheetOpen(true)}
            data-nearby-filter
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${
              isActive ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            {isActive && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-on-ink">
                {activeSpotFilterCount(filters)}
              </span>
            )}
          </button>
        </div>
      </div>

      <FilterSheet
        open={isSheetOpen}
        value={toSheet(filters)}
        hasDistanceCenter={false}
        variant="spots"
        onApply={(next) => {
          restoreSpotRef.current = null; // 条件を変えたら、復元の指定は忘れる
          setIsSheetOpen(false);
          onFiltersChange?.(fromSheet(next));
        }}
        onClose={() => setIsSheetOpen(false)}
      />

      {/* Task 4-2: 取得中を先に見る。移動手段を変えた直後もここに入り、古いカードは出ない */}
      {isFetching ? (
        <p role="status" className="py-6 text-center text-[12px] text-muted">読み込んでいます…</p>
      ) : failed ? (
        <p className="py-6 text-center text-[12px] text-muted">近くの投稿を読み込めませんでした</p>
      ) : visiblePosts === null ? (
        <p role="status" className="py-6 text-center text-[12px] text-muted">読み込んでいます…</p>
      ) : visiblePosts.length === 0 ? (
        /* explore-mode Task 4: 絞り込みが効いているときは、範囲ではなく条件のせいだと分かる文言にする */
        <p className="py-6 text-center text-[12px] text-muted">
          {isActive ? "条件に合う場所がありません" : "この範囲に投稿はありません。移動手段を変えて範囲を広げてみてください"}
        </p>
      ) : (
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="-mx-4 flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-4 pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {visiblePosts.map((post, index) => (
            <button
              key={post.id}
              type="button"
              onClick={() => selectOrOpen(index)}
              data-nearby-card={post.id}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`flex w-[176px] shrink-0 snap-center flex-col gap-1 rounded-[12px] border p-2.5 text-left ${
                index === activeIndex ? "border-accent" : "border-line"
              } bg-surface`}
            >
              <span className="truncate text-[13px] font-bold text-ink">{post.spotName}</span>
              {post.commentExcerpt && <span className="line-clamp-2 text-[11px] leading-[1.5] text-muted">{post.commentExcerpt}</span>}
              <span className="mt-auto flex items-center gap-2 text-[11px] text-muted">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[6px] bg-line">
                  {post.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span data-travel-minutes>{formatTravelMinutes(post.minutes ?? post.walkMinutes, post.mode ?? mode)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

async function defaultFetchNearbyPosts(center: { lat: number; lng: number }, mode: TravelMode, filters: SpotFilters = EMPTY_SPOT_FILTERS): Promise<NearbyPost[]> {
  const params = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), mode });
  // explore-mode Task 4: 条件は API にも渡す（サーバーが同じ判定で絞る）
  for (const [key, value] of spotFiltersToParams(filters)) params.set(key, value);
  const response = await fetchWithAuthRedirect(`/api/posts/nearby?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch nearby posts: ${response.status}`);
  const data = (await response.json()) as { posts: NearbyPost[] };
  return data.posts;
}
