import * as React from "react";
import type { ReactNode } from "react";

/**
 * loading-feedback Task 8: 切り替わる瞬間の動き
 * 出典: docs/tasks/shared-ui/loading-feedback/08-view-transitions.md
 *       要件定義書 4.5.11 の場面 5・8 章 95
 *       Next.js 同梱ドキュメント 01-app/02-guides/view-transitions.md の Step 1・2
 *
 * 【初心者向け】ここには 2 種類の動きがある。
 *   - 8-1 骨組み → 本物の受け渡し … **2026-10-25 に廃止**（下記）→ 同日、**現れる側だけ別の作り方で戻した**（`ContentEnter`）
 *   - 8-2 一覧の写真 → 詳細の写真が繋がって育つ … **そのまま残っている**（`PhotoMorph`）
 */

/*
 * #1029（2026-10-25）: **骨組み → 本物の受け渡しの動きをやめた。**
 *
 * 【初心者向け】ここは「骨組みは下に退き、本物は下から上がる」を
 * ブラウザの仕組み（View Transitions API）で繋げていました。
 *
 * ところが **iPhone では、本物が下からではなく右下から斜めに出てきます**。
 * 実機の画面収録を 1 コマずつ測ると、こうなっていました。
 *
 *   2.00s  dx=0  dy=0    （骨組み。ずれていない）
 *   2.30s  dx=7  dy=13
 *   2.40s  dx=7  dy=5
 *   2.45s  dx=7  dy=0
 *   2.50s  dx=0  dy=0    （ここで一瞬で戻る）
 *
 * **縦はなめらかに減るのに、横は 7 のまま動かず、最後に一瞬で戻る。**
 * つまり横は動きではなく、**置かれる位置**がずれています。画面の 5 か所を測って
 * すべて同じ値だったので、拡大縮小ではなく**まるごと平行にずれて**います。
 *
 * こちらが CSS で指示しているのは**縦 10px だけ**で、横は 0 です。同じコードを
 * Chrome・デスクトップの WebKit・iPhone として動かした WebKit で測ると、
 * **3 つとも指示どおり**でした。**iOS が写しをずれた位置に置いており、
 * こちらが直せる場所にありません。**
 *
 * 直せるのは「この仕組みを使うかどうか」だけなので、使うのをやめます。
 * 本物はその場に現れます。**動かないほうが、斜めにずれるより良い**という判断
 * （要件定義書 4.5.11「場面 5 の決着」）。
 *
 * **包み（`SkeletonExit` / `ContentEnter`）は残してあります。** 中身をそのまま返す
 * だけの素通しです。動きを戻すことになったら（9 章 未決定事項 20）、18 画面を
 * 触らずに**このファイルだけ**で戻せます。
 */

/*
 * 【初心者向け】なぜ `import { ViewTransition } from "react"` と直に書かないか。
 *
 * `ViewTransition` は **Next.js が同梱している React にだけある**。
 * Next.js の App Router は React の canary を同梱していて、`react` と書くと
 * ビルド時にそちらへ差し替わる（同梱ドキュメント: 「View transitions work in the
 * App Router with no configuration」「You do not need to install react@canary yourself」）。
 *
 * ところが**単体テストはそこを通らない**。vitest は `node_modules/react`（安定版）を
 * 読むので `ViewTransition` が無く、名前で取り出すと描画の瞬間に落ちる（実際に落ちた）。
 *
 * そこで「あれば使い、無ければそのまま描く」形にしてある。これはテストのための
 * 逃げ道ではなく、**実際の挙動**でもある。同梱ドキュメントにも
 * 「対応していないブラウザでは動かないだけで壊れない」と書かれている。
 */
const ViewTransition = (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> }).ViewTransition;

interface ViewTransitionProps {
  children: ReactNode;
  enter?: string;
  exit?: string;
  name?: string;
  share?: string;
  default?: string;
}

/** 退く側（`loading.tsx` や Suspense の fallback に出す骨組み）。#1029 以降は素通し */
export function SkeletonExit({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * 現れる側（本物の画面の中身）。
 *
 * #1032（2026-10-25）: **下から 10px 上がりながら現れる動きを戻した。**
 * ただし #1029 でやめた**ビュートランジションは使わない**（写しを作るとずれるため）。
 * ふつうの CSS アニメーションで、**本物の要素をそのまま**動かす。
 *
 * 【初心者向け】動きの中身は globals.css の `.content-enter` にある。
 * そこで `transform` ではなく `position: relative` ＋ `top` を動かしている理由も、
 * **必ずそちらを読むこと**（この包みの中には `position: fixed` のものがある）。
 */
export function ContentEnter({ children }: { children: ReactNode }) {
  return <div className="content-enter">{children}</div>;
}

/**
 * 一覧の写真と投稿詳細の写真を繋げる（Task 8-2）。
 *
 * 【初心者向け】同じ `name` を付けた要素が前の画面と次の画面の両方にあると、
 * ブラウザが**その 1 枚が動いて育った**ように見せる。押した写真がそのまま詳細の大きな写真になる。
 * `name` には投稿の id を使う。**1 つの画面に同じ名前が 2 つあると、どちらを繋ぐか決まらない**ので、
 * 同じ投稿が複数並びうる場所（写真タブ）では使わない。
 */
export function PhotoMorph({ postId, children }: { postId: string; children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition name={`photo-${postId}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
