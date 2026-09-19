"use client";

import { useEffect, useRef, useState } from "react";
import { requestCurrentPosition } from "@/lib/geo/use-current-position";
import { loadListState, saveListState } from "@/lib/search/list-state";

/**
 * mentoring-7 Task3（v3.1）: 検索結果（スポットカード）と投稿一覧（投稿カード）で共通の仕組みを切り出したもの
 * 出典: docs/tasks/map-search/post-timeline/03-scroll-and-back.md（元は PostSearchScreen の中にあった）
 *
 * 【初心者向け】2 つの画面（PostSearchScreen・SpotSearchScreen）で同じことをするので、React の「カスタムフック」にまとめた。
 *   - useListRestore: 地図から戻ってきたときに、読み込み済みページ数とスクロール位置を sessionStorage から戻す／保存する
 *   - useViewerPosition: 位置情報の許可が既に出ているときだけ現在地を取る（「徒歩 N 分」用。許可ダイアログは出さない）
 */

/** 1 ページの件数（サーバー側の既定と揃える） */
export const LIST_PAGE_SIZE = 20;

export function useListRestore({
  pageHref,
  itemCount,
  initialNextOffset,
  loadPage,
}: {
  pageHref: string;
  itemCount: number;
  initialNextOffset: number | null;
  /** offset のページを追加で読み、次の offset を返す（null なら終わり） */
  loadPage: (offset: number) => Promise<number | null>;
}) {
  // 初回だけ: 保存された状態があれば同じページ数まで読み込み、スクロール位置を戻す
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadListState(pageHref);
    if (!saved) return;
    let cancelled = false;
    const restore = async () => {
      let offset: number | null = initialNextOffset;
      for (let pageNo = 2; pageNo <= saved.loadedPages && offset !== null && !cancelled; pageNo++) {
        offset = await loadPage(offset);
      }
      if (!cancelled) {
        // 描画が終わってからスクロールする（同期だと高さが足りず途中で止まる）
        requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY }));
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [pageHref, initialNextOffset, loadPage]);

  // スクロールのたび（間引き）と離脱時に保存
  const loadedPages = Math.max(1, Math.ceil(itemCount / LIST_PAGE_SIZE));
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const save = () => saveListState(pageHref, { scrollY: window.scrollY, loadedPages });
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        save();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (frame) cancelAnimationFrame(frame);
      save();
    };
  }, [pageHref, loadedPages]);
}

export function useViewerPosition(geolocation?: Pick<Geolocation, "getCurrentPosition">, permissions?: Pick<Permissions, "query">) {
  const [viewer, setViewer] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const perms = permissions ?? (typeof navigator === "undefined" ? undefined : navigator.permissions);
      if (!perms?.query) return;
      try {
        const status = await perms.query({ name: "geolocation" });
        if (status.state !== "granted" || cancelled) return;
        const result = await requestCurrentPosition(geolocation ?? navigator.geolocation);
        if (result.ok && !cancelled) setViewer({ lat: result.lat, lng: result.lng });
      } catch {
        // Permissions API 非対応ブラウザでは徒歩分を出さない
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [geolocation, permissions]);
  return viewer;
}
