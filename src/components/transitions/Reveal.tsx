import * as React from "react";
import type { ReactNode } from "react";

/**
 * loading-feedback Task 8-1: 骨組みが本物に受け渡す動き
 * 出典: docs/tasks/shared-ui/loading-feedback/08-view-transitions.md
 *       要件定義書 4.5.11 の場面 5・8 章 95
 *       Next.js 同梱ドキュメント 01-app/02-guides/view-transitions.md の Step 2
 *
 * 【初心者向け】`loading.tsx` が出ている状態から本物の画面に切り替わる瞬間を、
 * ブラウザの仕組み（View Transitions API）で繋げる。
 *   - 骨組みは**下に 10px ずれながら薄くなって消える**（速く。150ms）
 *   - 本物は**下から 10px 上がりながら現れる**（ゆっくり。現れるのは 210ms、移動は 400ms）
 * 先に消して、あとからゆっくり出すのは、**古いものが注意を引かないようにする**ため。
 *
 * 動きの中身（キーフレーム）は globals.css にある。名前（skeleton-out・content-in）を合わせること。
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

/** 退く側（`loading.tsx` や Suspense の fallback に出す骨組み） */
export function SkeletonExit({ children }: { children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  // `default="none"` が無いと、関係のない切り替わりのたびに毎回動いてしまう（同梱ドキュメントの注意書き）
  return (
    <ViewTransition exit="skeleton-out" default="none">
      {children}
    </ViewTransition>
  );
}

/** 現れる側（本物の画面の中身） */
export function ContentEnter({ children }: { children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition enter="content-in" default="none">
      {children}
    </ViewTransition>
  );
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
