"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSheetDrag } from "./use-sheet-drag";

/**
 * mentoring-7 Task4・Task11（v3.1）: 上 1/3 地図＋下 2/3 シートの共通レイアウト（スライドで全画面 ⇄ 1：2）
 * 出典: docs/tasks/shared-ui/mentoring-7/04-map-on-top.md
 *       docs/tasks/shared-ui/mentoring-7/11-sheet-drag.md
 *       要件定義書 v3.1 3.4.2・3.5.1、v3.2 4.5.6
 *
 * 【初心者向け】スポット別一覧（SC-04）・投稿詳細（SC-05）・しおり詳細の地図表示（SC-23）で同じ見た目にするための枠。
 *   - スマホ: 地図を上に貼り付け（sticky）、その下にシートを置く。シートはページごとスクロールするので、
 *     上に引くと地図の上に被さって全画面のように見え、先頭まで戻すと 1：2 に戻る
 *   - 「途中で止めない（2 段階に吸い付く）」は CSS の scroll-snap で実現する。吸い付く場所は「ページの先頭（1：2）」と
 *     「シートの上端（全画面）」の 2 か所だけ。proximity なので、シートの中を深くスクロールしているときは邪魔しない
 *   - 取っ手（＝ボタン）は指のスライド（use-sheet-drag.ts）と Enter／Space で 1：2 ⇄ 全画面を切り替える
 *   - パソコン幅（md 以上）: 左 1：右 2 の左右分割でスライドは無い
 * ページのスクロール（window）をそのまま使うので、一覧の「スクロール位置の復元」（use-search-list.ts）もそのまま効く。
 * 投稿画面（SC-03）は入力中に地図を動かす必要があるため、別の構成（PostComposeScreen）のまま。取っ手の動きだけ同じフックを使う。
 */
export function MapSheetLayout({ map, children, className }: { map: ReactNode; children: ReactNode; className?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // 吸い付く場所は document 全体のスクロールなので、html 要素に scroll-snap を付ける（この画面の間だけ）
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollSnapType;
    root.style.scrollSnapType = "y proximity";
    const onScroll = () => {
      const mapHeight = mapRef.current?.offsetHeight ?? 0;
      setExpanded(mapHeight > 0 && window.scrollY >= mapHeight - 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      root.style.scrollSnapType = previous;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const scrollTo = (top: number) => {
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  };
  const expand = () => scrollTo(mapRef.current?.offsetHeight ?? 0);
  const collapse = () => scrollTo(0);
  const handle = useSheetDrag((snap) => (snap === "expand" ? expand() : collapse()), () => (expanded ? collapse() : expand()));

  return (
    <div className={`flex min-h-screen flex-col bg-app md:flex-row md:items-stretch ${className ?? ""}`} data-map-sheet-layout data-sheet-expanded={expanded ? "true" : "false"}>
      {/* 上 1/3（パソコンでは左 1/3）: 地図。sticky なのでシートが上に被さる。ページの先頭が 1 つ目の吸い付き点 */}
      <div ref={mapRef} className="sticky top-0 z-0 h-[34dvh] shrink-0 md:sticky md:h-dvh md:w-1/3" style={{ scrollSnapAlign: "start" }}>
        {map}
      </div>
      {/* 下 2/3（パソコンでは右 2/3）: シート。上端が 2 つ目の吸い付き点（＝全画面） */}
      <div
        className="relative z-10 -mt-4 flex min-h-[66dvh] flex-1 flex-col rounded-t-[16px] border-t border-line bg-app shadow-card md:mt-0 md:min-h-dvh md:rounded-none md:border-l md:border-t-0"
        style={{ scrollSnapAlign: "start", scrollMarginTop: 0 }}
      >
        <button
          type="button"
          {...handle}
          onClick={() => (expanded ? collapse() : expand())}
          aria-label={expanded ? "シートを戻す（地図を表示）" : "シートを広げる（全画面）"}
          aria-expanded={expanded}
          data-sheet-handle
          className="flex h-5 w-full touch-none items-center justify-center md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </button>
        {children}
      </div>
    </div>
  );
}
