import type { ReactNode } from "react";

/**
 * performance Task2（2026-09-22）: 読み込み中の骨組み（スケルトン）
 * 出典: docs/tasks/shared-ui/performance/02-streaming.md
 *
 * 【初心者向け】データが来る前に「ここに何が出るか」を灰色の枠で見せる部品。Instagram の読み込み中と同じ。
 * `loading.tsx`（画面遷移の直後）と、ページ内の Suspense の fallback（1 ページ目が届くまで）の両方で使う。
 * hooks を使わないので Server Component からもそのまま描ける。`aria-busy` と「読み込んでいます」でスクリーンリーダーにも伝える。
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[8px] bg-tint ${className}`} />;
}

/** 画面上部の帯（戻る・タイトル・右のボタン）。タイトルが分かっていれば文字で出す */
export function TopBarSkeleton({ backLabel, title, right = true }: { backLabel?: string | null; title?: string | null; right?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {backLabel ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </span>
      ) : (
        <SkeletonBlock className="h-8 w-16" />
      )}
      {title ? <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">{title}</h1> : <SkeletonBlock className="mx-auto h-5 w-32" />}
      {right ? <SkeletonBlock className="h-8 w-16 rounded-full" /> : <span className="w-16" />}
    </div>
  );
}

/** 投稿カード・スポットカードの枠 */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3">
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3 w-1/4" />
      <div className="flex gap-3">
        <SkeletonBlock className="h-[92px] w-[92px] shrink-0 rounded-[10px]" />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

/** カードを縦に並べた一覧の枠 */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** 一覧画面（戻る・タイトル・カードの列）の骨組み。loading.tsx 用 */
export function ListScreenSkeleton({ backLabel, title, children }: { backLabel?: string | null; title?: string | null; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4">
        <TopBarSkeleton backLabel={backLabel} title={title} />
        {children ?? <CardListSkeleton />}
      </div>
    </div>
  );
}

/** 上 1/3 地図＋下 2/3 シート（スポット別一覧・投稿詳細・しおり）の骨組み。loading.tsx 用 */
export function MapSheetSkeleton({ backLabel, title, children }: { backLabel?: string | null; title?: string | null; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-app md:flex-row">
      <div aria-hidden className="h-[34dvh] w-full animate-pulse bg-map-placeholder md:h-dvh md:w-1/3" />
      <div className="relative z-10 -mt-4 flex flex-1 flex-col rounded-t-[16px] border-t border-line bg-app px-4 pt-3 pb-8 md:mt-0 md:rounded-none md:border-l md:border-t-0">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
          <TopBarSkeleton backLabel={backLabel} title={title} />
          {children ?? <CardListSkeleton />}
        </div>
      </div>
    </div>
  );
}

/** 投稿詳細の本文の枠（写真・見出し・本文） */
export function PostDetailBodySkeleton() {
  return (
    <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-3">
      <SkeletonBlock className="h-5 w-2/3" />
      <SkeletonBlock className="aspect-square w-full rounded-[12px]" />
      <SkeletonBlock className="h-3 w-1/3" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-5/6" />
    </div>
  );
}

/** コメント欄の枠 */
export function CommentsSkeleton() {
  return (
    <div role="status" aria-busy aria-label="コメントを読み込んでいます" className="flex flex-col gap-3">
      <SkeletonBlock className="h-4 w-24" />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex gap-2">
          <SkeletonBlock className="h-7 w-7 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <SkeletonBlock className="h-3 w-1/4" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
