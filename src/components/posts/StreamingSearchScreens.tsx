"use client";

import { use, type ComponentProps } from "react";
import type { SearchFirstPage } from "@/lib/search/load-search-page";
import { SpotPostListScreen } from "./SpotPostListScreen";
import { SpotSearchScreen } from "./SpotSearchScreen";

/**
 * performance Task2（2026-09-22）: 1 ページ目を「後から届く Promise」として受け取る薄い包み
 * 出典: docs/tasks/shared-ui/performance/02-streaming.md
 *
 * 【初心者向け】Server Component（page.tsx）は 1 ページ目を待たずに HTML を返し始め、1 ページ目の Promise を
 * このクライアント部品に渡す。`use(promise)` は「まだ届いていなければ、外側の Suspense に骨組みを出させて待つ」
 * React の仕組み。届いたら本来の画面（SpotPostListScreen／SpotSearchScreen）をそのまま描く。
 * 中身の画面には手を入れていないので、条件の変更や無限スクロールは今までどおり動く。
 */
type SpotListProps = Omit<ComponentProps<typeof SpotPostListScreen>, "initialPage" | "initialMediaPage">;

export function StreamingSpotPostListScreen({ firstPage, ...rest }: SpotListProps & { firstPage: Promise<SearchFirstPage> }) {
  const page = use(firstPage);
  return <SpotPostListScreen {...rest} initialPage={page.initialPage} initialMediaPage={page.initialMediaPage} />;
}

type SearchProps = Omit<ComponentProps<typeof SpotSearchScreen>, "initialPage" | "initialMediaPage">;

export function StreamingSpotSearchScreen({ firstPage, ...rest }: SearchProps & { firstPage: Promise<SearchFirstPage> }) {
  const page = use(firstPage);
  return <SpotSearchScreen {...rest} initialPage={page.initialSpotPage} initialMediaPage={page.initialMediaPage} />;
}
