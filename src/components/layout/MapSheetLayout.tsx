"use client";

import type { ReactNode } from "react";

/**
 * mentoring-7 Task4（v3.1）: 上 1/3 地図＋下 2/3 シートの共通レイアウト
 * 出典: docs/tasks/shared-ui/mentoring-7/04-map-on-top.md
 *       要件定義書 v3.1 3.4.2・3.5.1、v3.2 4.5.6（スライドの動きは Task 11 #432 で足す）
 *
 * 【初心者向け】スポット別一覧（SC-04）・投稿詳細（SC-05）・しおり詳細の地図表示（SC-23）で同じ見た目にするための枠。
 *   - スマホ: 地図を上に貼り付け（sticky）、その下にシートを置く。シートはページごとスクロールするので、
 *     上に引くと地図の上に被さって全画面のように見え、先頭まで戻すと 1：2 に戻る（ブラウザの通常のスクロール）
 *   - パソコン幅（md 以上）: 左 1：右 2 の左右分割
 * ページのスクロール（window）をそのまま使うので、一覧の「スクロール位置の復元」（use-search-list.ts）もそのまま効く。
 * 投稿画面（SC-03）は入力中に地図を動かす必要があるため、別の構成（PostComposeScreen）のまま。
 */
export function MapSheetLayout({ map, children, className }: { map: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-screen flex-col bg-app md:flex-row md:items-stretch ${className ?? ""}`} data-map-sheet-layout>
      {/* 上 1/3（パソコンでは左 1/3）: 地図。sticky なのでシートが上に被さる */}
      <div className="sticky top-0 z-0 h-[34dvh] shrink-0 md:sticky md:h-dvh md:w-1/3">{map}</div>
      {/* 下 2/3（パソコンでは右 2/3）: シート */}
      <div className="relative z-10 -mt-4 flex min-h-[66dvh] flex-1 flex-col rounded-t-[16px] border-t border-line bg-app shadow-card md:mt-0 md:min-h-dvh md:rounded-none md:border-l md:border-t-0">
        <div aria-hidden className="flex h-5 w-full items-center justify-center md:hidden">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        {children}
      </div>
    </div>
  );
}
