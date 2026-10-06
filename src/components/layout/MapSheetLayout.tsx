"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSheetContentDrag, useSheetDrag } from "./use-sheet-drag";
import { SheetHandleBar } from "@/components/ui/SheetHandleBar";

/**
 * mentoring-7 Task4・Task11（v3.1）: 上 1/3 地図＋下 2/3 シートの共通レイアウト
 * map-sheet Task2（2026-09-26）: 2 段階 → 3 段階（地図 2/3 ／ 地図 1/3（既定） ／ 全画面）
 * 出典: docs/tasks/shared-ui/mentoring-7/04-map-on-top.md・11-sheet-drag.md
 *       docs/tasks/shared-ui/map-sheet/02-three-step-sheet.md
 *       要件定義書 4.5.6
 *
 * 【初心者向け】スポット別一覧（SC-04）・投稿詳細（SC-05）・しおり詳細の地図表示（SC-23）で同じ見た目にするための枠。
 *
 * 段階は下から順に 3 つ。
 *   1. 地図 2/3・シート 1/3 … 位置関係を見る段階（探すモードと同じ比率）。シートは `summary` の 1 行だけ
 *   2. 地図 1/3・シート 2/3 … 既定。画面を開いた直後はここ
 *   3. 全画面 … 地図は隠れ、シートだけ
 *
 * しくみは 2 つに分かれている。
 *   - 1 と 2 の違いは「地図の高さ」（34dvh ⇄ 66dvh）。React の状態で切り替える
 *   - 2 と 3 の違いは「ページのスクロール位置」。地図は sticky なので、ページを地図の高さだけ
 *     スクロールするとシートが地図に完全に被さり、全画面のように見える
 * 「途中で止めない」は CSS の scroll-snap（ページの先頭とシートの上端の 2 か所）に任せる。
 * 取っ手（＝ボタン）は指のスライド（use-sheet-drag.ts）で 1 段階ずつ、Enter／Space で次の段階へ進む。
 * パソコン幅（md 以上）は左 1：右 2 の左右分割で、段階の切り替えは無い。
 */
/** 段階。map = 地図 2/3、default = 地図 1/3（既定）、full = 全画面 */
export type SheetStep = "map" | "default" | "full";

export function MapSheetLayout({
  map,
  summary,
  steps = 3,
  children,
  className,
}: {
  map: ReactNode;
  /** 地図を広くした段階（map）でシートに出す見出しの 1 行。省略すると本文をそのまま出す */
  summary?: ReactNode;
  /** 段階の数。2 にすると「地図 2/3」が無くなる（SC-03 のように入力中に地図が広がると困る画面用） */
  steps?: 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // 全画面かどうか（ページのスクロール位置で決まる）
  const [expanded, setExpanded] = useState(false);
  // 地図を広くしているか（React の状態）。steps が 2 のときは常に false
  const [tallMap, setTallMap] = useState(false);
  const step: SheetStep = expanded ? "full" : tallMap ? "map" : "default";

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

  /** 1 段階シートを広げる（地図を狭くする方向） */
  const goUp = () => {
    if (tallMap) {
      setTallMap(false);
      return;
    }
    if (!expanded) scrollTo(mapRef.current?.offsetHeight ?? 0);
  };

  /** 1 段階シートを縮める（地図を広くする方向）。いちばん下（地図 2/3）からは動かさない */
  const goDown = () => {
    if (expanded) {
      // 全画面の 1 つ下は既定（地図 1/3）。地図を広くしたまま全画面までスクロールしていても、まず既定に戻す
      scrollTo(0);
      setTallMap(false);
      return;
    }
    if (steps === 3 && !tallMap) setTallMap(true);
  };

  /** キーボード（Enter／Space）は次の段階へ。いちばん上（全画面）まで行ったら既定に戻る */
  const toggle = () => (expanded ? goDown() : goUp());

  const handle = useSheetDrag((snap) => (snap === "expand" ? goUp() : goDown()), toggle);
  // map-sheet Bug1: 取っ手が掴みにくかったので、内容を下に引いても縮むようにする（4.5.6）
  const content = useSheetContentDrag(goDown);
  const handleLabel = expanded ? "シートを戻す（地図を表示）" : tallMap ? "シートを広げる（地図を小さく）" : "シートを広げる（全画面）";

  return (
    <div
      className={`flex min-h-screen flex-col bg-app md:flex-row md:items-stretch ${className ?? ""}`}
      data-map-sheet-layout
      data-sheet-step={step}
      data-sheet-expanded={expanded ? "true" : "false"}
    >
      {/* 上の地図（パソコンでは左）: sticky なのでシートが上に被さる。ページの先頭が 1 つ目の吸い付き点 */}
      <div
        ref={mapRef}
        className={`sticky top-0 z-0 shrink-0 transition-[height] duration-200 motion-reduce:transition-none md:sticky md:h-dvh md:w-1/3 ${tallMap ? "h-[66dvh]" : "h-[34dvh]"}`}
        style={{ scrollSnapAlign: "start" }}
      >
        {map}
      </div>
      {/* 下のシート（パソコンでは右）: 上端が 2 つ目の吸い付き点（＝全画面） */}
      <div
        {...content}
        className={`relative z-10 -mt-4 flex flex-1 flex-col rounded-t-[16px] border-t border-line bg-app shadow-card md:mt-0 md:min-h-dvh md:rounded-none md:border-l md:border-t-0 ${tallMap ? "min-h-[34dvh]" : "min-h-[66dvh]"}`}
        style={{ scrollSnapAlign: "start", scrollMarginTop: 0 }}
      >
        <button
          type="button"
          {...handle}
          onClick={toggle}
          aria-label={handleLabel}
          aria-expanded={expanded}
          data-sheet-handle
          // 4.5.6: 掴める範囲は 32px 以上（h-8）。見た目の線は細いまま
          className="flex h-8 w-full touch-none items-center justify-center md:hidden"
        >
          <SheetHandleBar />
        </button>
        {/* 地図を広くした段階では見出しの 1 行だけ。続きは上にスライドして読む（4.5.6） */}
        {tallMap && summary ? <div data-sheet-summary>{summary}</div> : children}
      </div>
    </div>
  );
}
