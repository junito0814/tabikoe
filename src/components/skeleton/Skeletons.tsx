import type { ReactNode } from "react";
import { SkeletonExit } from "@/components/transitions/Reveal";

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
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[560px] flex-col gap-4">
          <TopBarSkeleton backLabel={backLabel} title={title} />
          {children ?? <CardListSkeleton />}
        </div>
      </div>
    </SkeletonExit>
  );
}

/** 上 1/3 地図＋下 2/3 シート（スポット別一覧・投稿詳細・しおり）の骨組み。loading.tsx 用 */
export function MapSheetSkeleton({ backLabel, title, children }: { backLabel?: string | null; title?: string | null; children?: ReactNode }) {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col bg-app md:flex-row">
        <div aria-hidden className="h-[34dvh] w-full animate-pulse bg-map-placeholder md:h-dvh md:w-1/3" />
        <div className="relative z-10 -mt-4 flex flex-1 flex-col rounded-t-[16px] border-t border-line bg-app px-4 pt-3 pb-8 md:mt-0 md:rounded-none md:border-l md:border-t-0">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
            <TopBarSkeleton backLabel={backLabel} title={title} />
            {children ?? <CardListSkeleton />}
          </div>
        </div>
      </div>
    </SkeletonExit>
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

/*
 * loading-feedback Task 5（2026-10-02）: 受け皿を 8 枚増やすために足した部品。
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *
 * 【初心者向け】上の `ListScreenSkeleton` は「戻る・タイトル・カードの列」の形で、
 * 戻る帯のある一覧画面に合わせてある。これから足す 8 枚のうち多くは
 * **戻る帯が無く、中央に見出しが 1 つ**の形なので、その土台を別に用意する。
 * 形を画面ごとに書き写すと、片方だけ直してズレるので部品にする（約束 14）。
 */

/** 見出しだけの画面（戻る帯が無いもの）の土台。タイトルは分かっているので文字で出す */
export function HeadingScreenSkeleton({
  title,
  maxWidth = "max-w-[420px]",
  children,
}: {
  title: string;
  /** 本物の画面と同じ幅にする（ズレると切り替わった瞬間に動いて見える） */
  maxWidth?: string;
  children?: ReactNode;
}) {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-6 py-10">
        <div className={`flex w-full flex-col gap-5 ${maxWidth}`}>
          <h1 className="text-[18px] font-bold text-ink">{title}</h1>
          <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-4">
            {children}
          </div>
        </div>
      </div>
    </SkeletonExit>
  );
}

/** 枠で囲んだ箱 1 つ（規約の再同意・アカウントの状態の各節） */
export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] border border-line bg-surface p-4">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** ラベルと操作が横に並ぶ行の列（アカウント） */
export function RowListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-11 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

/** 格子に並ぶ札（ステータスバッジ） */
export function GridSkeleton({ rows = 3, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex flex-col gap-2">
          <SkeletonBlock className="h-3 w-24" />
          <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {Array.from({ length: cols }, (_, c) => (
              <SkeletonBlock key={c} className="h-[72px] rounded-[10px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 画面の真ん中に箱 1 つ（招待リンクを開いたとき） */
export function CenteredCardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[380px] flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
          <SkeletonBlock className="h-4 w-1/2" />
          {Array.from({ length: lines }, (_, i) => (
            <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 ? "w-1/3" : "w-full"}`} />
          ))}
          <SkeletonBlock className="mt-1 h-11 w-full rounded-[10px]" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/** ロゴを中央に置いた画面（同意画面） */
export function LogoScreenSkeleton() {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[360px] flex-col items-center">
          <SkeletonBlock className="mb-6 h-[120px] w-[120px] rounded-full" />
          <SkeletonBlock className="mb-2.5 h-6 w-32" />
          <SkeletonBlock className="mb-8 h-3 w-48" />
          <div className="mb-6 flex w-full flex-col gap-3">
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-full" />
          </div>
          <SkeletonBlock className="h-[52px] w-full rounded-[10px]" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * 上 1/3 が地図、下 2/3 がフォームの画面（投稿画面）。
 *
 * 【初心者向け】`MapSheetSkeleton` と似ているが別物。あちらは「戻る帯＋カードの列」で、
 * こちらは入力欄が縦に並ぶ。割合（34%）も本物と同じにして、切り替わった瞬間に動かないようにする。
 */
export function ComposeScreenSkeleton() {
  return (
    <SkeletonExit>
      <div className="flex h-[calc(100dvh-60px)] flex-col bg-app md:h-dvh md:flex-row">
        <div aria-hidden className="h-[34%] w-full shrink-0 animate-pulse bg-map-placeholder md:h-full md:w-1/3" />
        <div className="flex min-h-0 flex-1 flex-col rounded-t-[16px] border-t border-line bg-app px-4 pt-4 shadow-card md:rounded-none md:border-l md:border-t-0">
          <div role="status" aria-busy aria-label="読み込んでいます" className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-11 w-full rounded-[10px]" />
            <SkeletonBlock className="h-11 w-full rounded-[10px]" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-[72px] w-[72px] rounded-[8px]" />
              <SkeletonBlock className="h-[72px] w-[72px] rounded-[8px]" />
            </div>
            <SkeletonBlock className="h-20 w-full rounded-[10px]" />
          </div>
        </div>
      </div>
    </SkeletonExit>
  );
}
