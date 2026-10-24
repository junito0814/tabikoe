import type { ReactNode } from "react";
import { SkeletonExit } from "@/components/transitions/Reveal";
import { BackChevron } from "@/components/layout/BackLink";

/**
 * performance Task2（2026-09-22）: 読み込み中の骨組み（スケルトン）
 * 出典: docs/tasks/shared-ui/performance/02-streaming.md
 *
 * 【初心者向け】データが来る前に「ここに何が出るか」を灰色の枠で見せる部品。Instagram の読み込み中と同じ。
 * `loading.tsx`（画面遷移の直後）と、ページ内の Suspense の fallback（1 ページ目が届くまで）の両方で使う。
 * hooks を使わないので Server Component からもそのまま描ける。`aria-busy` と「読み込んでいます」でスクリーンリーダーにも伝える。
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  /*
   * loading-feedback Task 11（2026-10-02）: 動きを `animate-pulse` から
   * **光が流れる形（シマー）**に変えた。動きの中身は globals.css の `.skeleton-block`。
   *
   * 【初心者向け】`animate-pulse` は 2 秒かけて 1 周する動きで、実際の待ち（0.5〜1.5 秒）だと
   * **半分も進まないうちに終わる**。止まって見えていたのはそのため。
   */
  return <div aria-hidden className={`skeleton-block rounded-[8px] bg-tint ${className}`} />;
}

/** 画面上部の帯（戻る・タイトル・右のボタン）。タイトルが分かっていれば文字で出す */
export function TopBarSkeleton({ backLabel, title, right = true }: { backLabel?: string | null; title?: string | null; right?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {backLabel ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
          {/* #813: 形は BackLink と同じものを使う（骨組みなのでリンクにはしない） */}
          <BackChevron />
          {backLabel}
        </span>
      ) : (
        <SkeletonBlock className="h-8 w-16" />
      )}
      {title ? <h1 className="min-w-0 flex-1 truncate text-center text-[1rem] font-bold text-ink">{title}</h1> : <SkeletonBlock className="mx-auto h-5 w-32" />}
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

/**
 * #936（2026-10-17）: 投稿履歴（SC-12）の骨組み。
 *
 * 【初心者向け】ここも `ListScreenSkeleton` を使い回していて、3 つずれていました。
 *   - 題名が ~~「あしあと」~~ のまま（#682 で「**投稿履歴**」に改称した）
 *   - 見出しが**中央寄せ 16px** だった（本物は**左寄せ 18px**。戻るはその上の行）
 *   - 幅が 560px だった（本物は **520px**）
 * さらに本物には「**一覧／地図**」の切替があり、骨組みには無いので行が 1 つ増えて見えていました。
 */
export function PostHistorySkeleton() {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[520px] flex-col gap-4">
          <header className="flex flex-col gap-2">
            {/* 本物は BackLink が独立した行（その下に大きな見出し） */}
            <span className="inline-flex h-8 w-fit shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
              <BackChevron />
              マイページ
            </span>
            <h1 className="text-[1.125rem] font-bold text-ink">投稿履歴</h1>
            {/* 「一覧／地図」の切替（h-7 の丸い 2 つ） */}
            <SkeletonBlock className="h-8 w-[104px] rounded-full" />
          </header>
          <CardListSkeleton />
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * #936（2026-10-17）: 下書き（SC-12 の中）の骨組み。
 *
 * 本物は**幅 420px**・`px-4 pt-4`・見出しは**戻ると同じ行の 17px**。
 * `ListScreenSkeleton`（560px・中央寄せ 16px・右にボタン）とは別物でした。
 */
export function DraftListSkeleton() {
  return (
    <SkeletonExit>
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-4 bg-app px-4 pt-4 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-6">
        <header className="flex items-center gap-2">
          <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
            <BackChevron />
            マイページ
          </span>
          <h1 className="text-[1.0625rem] font-bold text-ink">下書き</h1>
        </header>
        <CardListSkeleton />
      </div>
    </SkeletonExit>
  );
}

/**
 * 上 1/3 地図＋下 2/3 シート（スポット別一覧・投稿詳細・しおり）の骨組み。loading.tsx 用。
 *
 * #936（2026-10-17）: 本物（`MapSheetLayout`）と 2 つずれていた。
 *   - 中の幅が **560px** だった（本物は **520px**。読み込みが終わると 40px 縮んでいた）
 *   - シートの上端にある**掴む印**（h-8 のバー）が無く、中身が 32px 上に出ていた
 */
export function MapSheetSkeleton({ backLabel, title, children }: { backLabel?: string | null; title?: string | null; children?: ReactNode }) {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col bg-app md:flex-row">
        <div aria-hidden className="skeleton-block h-[34dvh] w-full bg-map-placeholder md:h-dvh md:w-1/3" />
        <div className="relative z-10 -mt-4 flex flex-1 flex-col rounded-t-[16px] border-t border-line bg-app pb-8 md:mt-0 md:rounded-none md:border-l md:border-t-0">
          {/* 本物のシートは上端に掴む印（h-8）がある。無いと中身が 32px 上にずれる */}
          <div aria-hidden className="flex h-8 w-full items-center justify-center md:hidden">
            <span className="h-1 w-9 rounded-full bg-line" />
          </div>
          <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4">
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
          <h1 className="text-[1.125rem] font-bold text-ink">{title}</h1>
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
        <div aria-hidden className="skeleton-block h-[34%] w-full shrink-0 bg-map-placeholder md:h-full md:w-1/3" />
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

/*
 * loading-feedback Task 11（2026-10-02・#650）: 本物と同じ形の骨組み 3 枚
 * 出典: docs/tasks/shared-ui/loading-feedback/11-skeleton-fidelity.md
 *       要件定義書 4.5.11 共通の決まり「骨組みは本物と同じ形にする」・8 章 99
 *
 * 【初心者向け】なぜ画面ごとに作るのか。
 * これまでは共通の `ListScreenSkeleton` を使い回していたが、**本物と形がずれていた**。
 * 読み込みが終わった瞬間にタイトルが中央から左へ飛び、少し大きくなり、画面が 40px 広がり、
 * 左右の灰色の枠が消えていた（4 つ同時に動いていた）。
 *
 * 骨組みの役目は「**何が**来るか」を見せること。**来ないものを見せてはいけない**。
 * そこで 3 画面それぞれに、本物と同じ値で作り直した。
 * 外枠（`px-4 py-6`・`max-w-[520px]`）は 3 枚とも本物と同じ。
 */

/** 3 枚に共通の外枠。本物と同じ余白・同じ幅にする */
function ScreenFrame({ gap, padding = "px-4 py-6", children }: { gap: string; padding?: string; children: ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col items-center bg-app ${padding}`}>
      <div className={`flex w-full max-w-[520px] flex-col ${gap}`}>{children}</div>
    </div>
  );
}

/** 左寄せの見出し。本物と同じ 18px・太字 */
function HeadingLeft({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-[1.125rem] font-bold text-ink">{title}</h1>
      {right}
    </div>
  );
}

/**
 * 通知（SC-14）の骨組み。
 * 本物は「左寄せ 18px の見出し」＋「丸（10px）＋ 2 行」の行が並ぶ。
 * **戻るも右のボタンも無い**ので、枠を置かない。
 */
export function NotificationListSkeleton() {
  return (
    <ScreenFrame gap="gap-3">
      <HeadingLeft title="通知" />
      <ul role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-start gap-3 rounded-[12px] border border-line bg-surface p-3">
            <SkeletonBlock className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <SkeletonBlock className="h-3.5 w-4/5" />
              <SkeletonBlock className="h-2.5 w-2/5" />
            </span>
          </li>
        ))}
      </ul>
    </ScreenFrame>
  );
}

/**
 * 計画（SC-22）の骨組み。
 *
 * #936（2026-10-17）: **本物とずれていたので作り直した。**
 * ~~見出しは「しおり」で、その右に「＋ 新規」~~ → #693 で画面名が「計画」になり、
 * 「しおり」は**小見出しに下がって**、「＋ 新規」もそちらへ移っていた（決定事項 75）。
 * 骨組みは当時のままだったので、読み込みが終わると**見出しが入れ替わり、行が 1 つ増えて**いた。
 *
 * 本物（`ItineraryListScreen.tsx`）の並び:
 *   「計画」（18px・mb-4）→ 「行きたいスポット」の 1 行（mb-3）→
 *   「しおり」＋「＋ 新規」（mb-2 mt-5）→ カード（gap-2.5）
 */
export function ItineraryListSkeleton() {
  return (
    <ScreenFrame gap="gap-0" padding="px-4 pt-6 pb-24">
      {/* 本物は `header` の中に h1 だけ（右にボタンは無い） */}
      <div className="mb-4">
        <HeadingLeft title="計画" />
      </div>
      <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col">
        {/* 「行きたいスポット」への入口（本物と同じく 1 行で、下に 12px） */}
        <div className="mb-3 flex items-center justify-between rounded-[12px] border border-line bg-surface p-3 shadow-card">
          <SkeletonBlock className="h-5 w-40" />
        </div>
        {/* #693: 「しおり」の小見出しと「＋ 新規」。本物は mb-2 mt-5 */}
        <div className="mb-2 mt-5 flex items-center justify-between">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-9 w-[84px] shrink-0 rounded-full" />
        </div>
        <ul className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface p-3 shadow-card">
              <span className="flex items-center justify-between gap-2">
                <SkeletonBlock className="h-4 w-2/5" />
                <SkeletonBlock className="h-3 w-24 shrink-0" />
              </span>
              <SkeletonBlock className="h-3 w-1/3" />
            </li>
          ))}
        </ul>
      </div>
    </ScreenFrame>
  );
}

/**
 * マイページ（SC-06）の骨組み。
 *
 * **見出しを出さないのが肝。** 本物に「マイページ」という見出しは無く、
 * 出るのは**アイコン（64px の丸）＋ユーザー名**。骨組みで見出しを出すと、
 * 読み込みが終わった瞬間に**タイトルごと消える**（#650 で実際に起きていた）。
 *
 * #936（2026-10-17）: **本物とずれていたので作り直した。** ずれていたのは 3 つ。
 *   - 「🏅 ステータスバッジ　5 / 63　›」の 1 行（#683 で足された）が**無かった**
 *   - メニューが **1 行 ＋ 2 列 4 つ**のままだった（#683 で **3 列 1 行**になっている）
 *   - **自分の投稿一覧**を出していた（#682 で「投稿履歴」へ移したので、ここにはもう無い）
 */
export function MyPageSkeleton() {
  return (
    <ScreenFrame gap="gap-5" padding="px-4 pt-6 pb-24">
      <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-5">
        {/* 1. プロフィール（アイコン 64px ＋ 名前 ＋ 右の「›」） */}
        <section className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-4">
          <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
          <SkeletonBlock className="h-4 w-1/2 flex-1" />
          <SkeletonBlock className="h-4 w-2 shrink-0" />
        </section>

        {/* 2. #683: ステータスバッジの 1 行（本物は px-4 py-3 の 1 行カード） */}
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3">
          <SkeletonBlock className="h-4 w-4 shrink-0 rounded-full" />
          <SkeletonBlock className="h-4 w-28 flex-1" />
          <SkeletonBlock className="h-4 w-12 shrink-0" />
        </div>

        {/* 3. サマリー（投稿数・獲得いいね） */}
        <section className="grid grid-cols-2 gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-[12px] border border-line bg-surface p-3">
              <SkeletonBlock className="h-2.5 w-14" />
              <SkeletonBlock className="h-5 w-10" />
            </div>
          ))}
        </section>

        {/* 4. #683: 遷移メニューは 3 列 1 行（行きたい・アルバム・投稿履歴） */}
        <nav className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full rounded-[10px]" />
          ))}
        </nav>
      </div>
    </ScreenFrame>
  );
}

/*
 * loading-feedback Task 11 の続き（2026-10-02・#653）: 残り 5 画面の骨組み
 *
 * 【初心者向け】#650 で 3 画面を直し、実機で効果を確かめたので残りに広げた。
 * 考え方は同じで、**本物と同じ値**にする（余白・幅・見出しの位置と大きさ・ボタンの有無・中身の形）。
 * ずれていると、読み込みが終わった瞬間に画面が動く。
 *
 * 外枠の余白と幅が画面ごとに違うことに注意（本物がそうなっているため）。
 *   アルバム一覧・アルバム詳細 … px-4 py-6 / 560px
 *   行きたい                   … px-4 pt-4 pb-8 / 520px
 *   検索結果                   … pb-6 ＋ 内側 px-4 pt-4 / 520px
 *   しおり詳細                 … px-4 pt-4 pb-24 / 520px
 */

/** 戻る（‹ ラベル）。本物と同じ 12px・高さ 32px */
function BackSkeleton() {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
      <BackChevron />
      <SkeletonBlock className="h-3 w-14" />
    </span>
  );
}

/**
 * アルバム一覧（SC-09）。
 * 本物は 560px・`py-6`、左寄せ 18px「アルバム」＋ 右に「マイページへ」の下線リンク、
 * カードは 2〜3 列の格子（正方形の画像 ＋ 題名 ＋ 補足）。
 */
export function AlbumListSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="w-full max-w-[560px]">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[1.125rem] font-bold text-ink">アルバム</h1>
          <SkeletonBlock className="h-3 w-20" />
        </header>
        <ul role="status" aria-busy aria-label="読み込んでいます" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="overflow-hidden rounded-[12px] border border-line bg-surface">
              <SkeletonBlock className="aspect-square w-full rounded-none" />
              <span className="block p-2.5">
                <SkeletonBlock className="h-3.5 w-3/4" />
                <SkeletonBlock className="mt-1.5 h-2.5 w-1/2" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * 行きたい（SC-12）。
 * 本物は 520px・`pt-4 pb-8`、戻る ＋ **中央 16px**「行きたい」＋ 右に「N 件」、
 * その下に一覧・地図の切替（h-7）、行は 64px の画像 ＋ 2 行。
 */
export function WishlistSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-4 pb-8">
      <div className="w-full max-w-[520px]">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <BackSkeleton />
            <h1 className="min-w-0 flex-1 truncate text-center text-[1rem] font-bold text-ink">行きたい</h1>
            <SkeletonBlock className="h-3 w-8 shrink-0" />
          </div>
          {/* 一覧・地図の切替（本物と同じ丸い入れ物） */}
          <div className="inline-flex w-fit gap-1 rounded-full border border-line bg-surface p-0.5">
            <SkeletonBlock className="h-7 w-14 rounded-full" />
            <SkeletonBlock className="h-7 w-14 rounded-full" />
          </div>
        </header>
        <ul role="status" aria-busy aria-label="読み込んでいます" className="mt-3 flex flex-col gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-2.5">
              <SkeletonBlock className="h-16 w-16 shrink-0 rounded-[8px]" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <SkeletonBlock className="h-3.5 w-2/3" />
                <SkeletonBlock className="h-2.5 w-2/5" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * 検索結果（SC-05）。
 * 本物は外枠 `pb-6` ＋ 内側 `px-4 pt-4`・520px、戻る ＋ 中央 16px のタイトル ＋
 * 「絞り込み」（h-8 の丸ボタン）、その下に表示切替（h-7）と並び替え（h-8）。
 */
export function PostSearchSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app pb-6">
      <div className="w-full max-w-[520px] px-4 pt-4">
        <header className="mb-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <BackSkeleton />
            <SkeletonBlock className="mx-auto h-4 w-32" />
            <SkeletonBlock className="h-8 w-20 shrink-0 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock className="h-7 w-28 rounded-full" />
            <SkeletonBlock className="h-8 w-24 rounded-full" />
          </div>
        </header>
        <CardListSkeleton />
      </div>
    </div>
  );
}

/**
 * アルバム詳細（SC-09 の中）。
 *
 * **ここがいちばんずれていた。** 本物は戻るが**独立した 1 行**で、その下に **20px の大きなタイトル**が来る。
 * 骨組みは 1 行に押し込んでいたので、読み込みが終わると行が増えて下が全部ずれていた。
 */
export function AlbumDetailSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[560px] flex-col gap-5">
        <header className="flex flex-col gap-2">
          {/* 戻るは上に 1 行（本物と同じ下線リンクの形） */}
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-6 w-1/2" />
        </header>
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex flex-col gap-5">
          <SkeletonBlock className="h-11 w-full rounded-[10px]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBlock key={i} className="aspect-square w-full rounded-[12px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * しおり詳細（SC-22）。
 * 本物は 520px・`pt-4 pb-24`、戻る ＋ 中央 16px のタイトル ＋ 「🗺 地図で見る」（h-8）＋「⋯」（h-8 w-8）。
 */
export function ItineraryDetailSkeleton() {
  return (
    <div className="min-h-screen bg-app">
      <div className="flex flex-col items-center px-4 pt-4 pb-24">
        <div className="w-full max-w-[520px]">
          <header className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <BackSkeleton />
              <SkeletonBlock className="mx-auto h-4 w-28" />
              <SkeletonBlock className="h-8 w-24 shrink-0 rounded-full" />
              <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
            </div>
            {/* Day タブ */}
            <div className="flex gap-1.5">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonBlock key={i} className="h-8 w-16 shrink-0 rounded-full" />
              ))}
            </div>
          </header>
          <ul role="status" aria-busy aria-label="読み込んでいます" className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3">
                <SkeletonBlock className="h-7 w-7 shrink-0 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <SkeletonBlock className="h-3.5 w-3/5" />
                  <SkeletonBlock className="h-2.5 w-1/3" />
                </span>
                <SkeletonBlock className="h-8 w-14 shrink-0 rounded-[8px]" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/*
 * #900（2026-10-09）: `loading.tsx` が無い画面のための骨組み。
 *
 * 【初心者向け】`loading.tsx` が無い画面では、Next.js は**前の画面を出したまま**次の HTML を待つ。
 * 白くはならないが、利用者には「押したのに何も起きない」と見える。本番で測ると、冷えた状態から
 * 立ち上がるのに 2.44 秒かかっていた（温まっていれば 0.21 秒）。その間ずっと無反応に見えていた。
 *
 * 作るときの決まりは 4.5.11 の「**骨組みは本物と同じ形にする**」。
 * ずれていると、読み込みが終わった瞬間に画面が動く（しおり・通知・マイページで実際に起きた）。
 * 下の部品はどれも、本物の `className` を見ながら幅・高さ・間隔を合わせてある。
 */

/**
 * #900: 速いときは出さず、遅いときだけ出す包み。
 *
 * 【初心者向け】要件 4.5.11 は、ホーム・地図・投稿履歴・通報に骨組みを「置かない」と決めていた。
 * 理由は「待ちがほぼ無く、置くと一瞬ちらつく」。**温まっているときはそのとおり**で、
 * 0.21 秒で消える骨組みは出た瞬間に消えるので目障りなだけ。
 *
 * ところが本番で測ると、**冷えた関数は立ち上がりに 2.44 秒**かかっていた。その間ずっと
 * 前の画面のままで、「押しても何も起きない」と見えていた。
 *
 * そこで最初の 0.18 秒は透明にして、それを過ぎたら現れるようにした（globals.css の
 * `.skeleton-delayed`）。速ければ見えないまま消え、遅ければちゃんと出る。JavaScript は要らない。
 */
export function DelayedSkeleton({ children }: { children: ReactNode }) {
  return <div className="skeleton-delayed">{children}</div>;
}

/** SC-00 検索トップ（ホーム）。空のグラデーション地に、ロゴ・検索窓・ボタン 2 つ */
export function SearchTopSkeleton() {
  return (
    <SkeletonExit>
      <div
        role="status"
        aria-busy
        aria-label="読み込んでいます"
        className="bg-sky flex min-h-[calc(100dvh-60px)] flex-col items-center justify-center gap-7 px-6 md:min-h-dvh"
      >
        {/* ロゴ（64px）とサービス名 */}
        <div className="flex flex-col items-center gap-3">
          <SkeletonBlock className="h-16 w-16 rounded-full" />
          <SkeletonBlock className="h-6 w-28" />
        </div>
        {/* 検索窓と、「近くのスポットを探す」「投稿」。どれも本物と同じ 52px・全角丸 */}
        <div className="flex w-full max-w-[360px] flex-col gap-3">
          <SkeletonBlock className="h-[52px] w-full rounded-full" />
          <SkeletonBlock className="h-[52px] w-full rounded-full" />
          <SkeletonBlock className="h-[52px] w-full rounded-full" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * SC-02 マップ。画面いっぱいの地図に、戻る・凡例・現在地・「投稿」が重なる。
 *
 * 【初心者向け】重ねる部品は `bg-surface`（白い面）にする。`SkeletonBlock` の既定は
 * `bg-tint`（淡い面）で、地図の下地（`--map-placeholder`）と明るさが近く、**見えなかった**。
 * 骨組みは「何が来るか」を見せるものなので、見えなければ役目を果たさない（要件 4.5.11）。
 */
export function MapScreenSkeleton() {
  return (
    <SkeletonExit>
      <div role="status" aria-busy aria-label="読み込んでいます" className="relative h-[calc(100dvh-60px)] w-full md:h-dvh">
        <div aria-hidden className="skeleton-block h-full w-full bg-map-placeholder" />
        {/* 上段: 戻る（左）と凡例（右）。本物は p-3 の中で gap-2 で並ぶ */}
        <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3">
          <SkeletonBlock className="h-8 w-24 rounded-full bg-surface" />
          <SkeletonBlock className="ml-auto h-8 w-32 rounded-full bg-surface" />
        </div>
        {/*
          * 右下: 現在地（40px の丸）と「投稿」。本物は right-3 / bottom-4 で縦に並ぶ。
          *
          * #1016（2026-10-24）: 文字が「ここに投稿」→「投稿」に短くなったので、幅も `w-32` → `w-20` に縮めた。
          * 骨組みが本物より広いと、**読み込み後にボタンの大きさが変わって見えます**（要件 4.5.11）。
          */}
        <div className="absolute bottom-4 right-3 flex flex-col items-end gap-2">
          <SkeletonBlock className="h-10 w-10 rounded-full bg-surface" />
          <SkeletonBlock className="h-10 w-20 rounded-full bg-surface" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * 規約・個人情報保護方針（SC-29）。見出しと本文が縦に長く続く。
 *
 * #936（2026-10-17）: 本物は **640px・`px-4 py-6`・`gap-3`** で、戻るは左端（`self-start`）。
 * ~~560px・`px-4 py-4`・中央寄せの題名~~ だったので、読み込みが終わると**本文の幅が 80px 広がって**いた。
 */
export function LegalDocumentSkeleton() {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[640px] flex-col gap-3">
          <span className="inline-flex h-8 w-fit shrink-0 items-center gap-1 self-start text-[0.75rem] font-medium text-muted">
            <BackChevron />
            ホーム
          </span>
          {/* 「利用規約 版 1.0　公開日 …」の 1 行 */}
          <SkeletonBlock className="h-3 w-48" />
          {/* いちばん上の見出し（本物は mt-2 の 20px） */}
          <SkeletonBlock className="mt-2 h-6 w-40" />
          <div className="mt-2 flex flex-col gap-6">
            {[0, 1, 2, 3].map((section) => (
              <div key={section} className="flex flex-col gap-2">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * #936（2026-10-17）: アカウント（SC-07）の骨組み。
 *
 * 本物は **420px・`px-4 pb-24 pt-4`**、左上に「‹ マイページ」、その下に 18px の見出し。
 * ~~`HeadingScreenSkeleton`（360px・`px-6 py-10`・戻る無し）~~ を使い回していたので、
 * 読み込みが終わると**幅が 60px 広がり、戻るが生えて**いた。
 */
export function AccountSkeleton() {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 pb-24 pt-4">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[420px] flex-col gap-4">
          <header className="flex flex-col gap-2">
            <span className="inline-flex h-8 w-fit shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
              <BackChevron />
              マイページ
            </span>
            <h1 className="text-[1.125rem] font-bold text-ink">アカウント</h1>
          </header>
          {/* 行の組（本物は 3 行・2 行・2 行の 3 組） */}
          {[3, 2, 2].map((rows, group) => (
            <ul key={group} className="w-full overflow-hidden rounded-[12px] border border-line bg-surface">
              {Array.from({ length: rows }, (_, i) => (
                <li key={i} className="flex min-h-12 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <SkeletonBlock className="h-4 w-32 flex-1" />
                  <SkeletonBlock className="h-3 w-3 shrink-0" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * #936（2026-10-17）: ステータスバッジ（SC-13）の骨組み。
 *
 * 本物は **`px-6 pb-12 pt-6`・`gap-6`**、左上に戻る、題名は**中央寄せ 16px**で下に「5 / 63 個を獲得」。
 * ~~`HeadingScreenSkeleton`（`px-6 py-10`・`gap-5`・左寄せ 18px）~~ とはどれも違っていた。
 */
export function BadgeListSkeleton() {
  return (
    <SkeletonExit>
      <div role="status" aria-busy aria-label="読み込んでいます" className="flex min-h-screen flex-col items-center gap-6 bg-app px-6 pb-12 pt-6">
        <div className="flex w-full max-w-[420px] items-center">
          <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
            <BackChevron />
            マイページ
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
        {Array.from({ length: 3 }, (_, section) => (
          <section key={section} className="flex w-full max-w-[420px] flex-col gap-2">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-3 w-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonBlock key={i} className="h-20 w-full rounded-[12px]" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SkeletonExit>
  );
}

/**
 * #936（2026-10-17）: 通報（SC-11）の骨組み。
 *
 * 【初心者向け】ここは共通の `FormScreenSkeleton`（560px・`px-4 py-4`・中央寄せの題名）を
 * 使い回していましたが、本物は **`px-6 pt-4 pb-12`・`gap-5`・題名は 16px** で、
 * 幅をそろえているのは中の部品（360px）の方でした。別物だったので、本物に合わせて作り直します。
 */
export function ReportFormSkeleton() {
  return (
    <SkeletonExit>
      <div role="status" aria-busy aria-label="読み込んでいます" className="flex min-h-screen flex-col items-center gap-5 bg-app px-6 pt-4 pb-12">
        {/* #870: 戻るは題名の上の行（幅いっぱいの左端） */}
        <div className="flex w-full max-w-[360px]">
          <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
            <BackChevron />
            戻る
          </span>
        </div>
        <SkeletonBlock className="h-5 w-40" />
        <div className="flex w-full max-w-[360px] flex-col gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-11 w-full rounded-[10px]" />
            </div>
          ))}
          <SkeletonBlock className="mt-2 h-[52px] w-full rounded-[10px]" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/**
 * #936（2026-10-17）: スポットの修正（通知から開く）の骨組み。
 *
 * 本物は **520px・`px-4 py-6`** で、戻るは「**通知**」（「戻る」ではない）、題名は 18px。
 */
export function SpotFixSkeleton() {
  return (
    <SkeletonExit>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[520px] flex-col gap-4">
          <header className="flex items-center gap-3">
            <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
              <BackChevron />
              通知
            </span>
            <h1 className="text-[1.125rem] font-bold text-ink">スポットの修正</h1>
          </header>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-11 w-full rounded-[10px]" />
            </div>
          ))}
          <SkeletonBlock className="mt-2 h-[52px] w-full rounded-[10px]" />
        </div>
      </div>
    </SkeletonExit>
  );
}

/** 他の人のプロフィール（SC-07 の公開側）。アイコン・名前・数字・投稿の列 */
export function PublicProfileSkeleton() {
  return (
    <SkeletonExit>
      {/* #936（2026-10-17）: 本物は 520px・`px-4 pb-24 pt-4`。~~560px・`px-4 py-4`~~ からそろえた */}
      <div className="flex min-h-screen flex-col items-center bg-app px-4 pb-24 pt-4">
        <div role="status" aria-busy aria-label="読み込んでいます" className="flex w-full max-w-[520px] flex-col gap-4">
          <header className="flex flex-col gap-3">
            {/* 本物は「戻る」と「⋯」が同じ行（間は空き） */}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted">
                <BackChevron />
                ホーム
              </span>
              <span className="flex-1" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            </div>
            {/* 「投稿 18　獲得いいね 17　登録した場所 3」の 1 行 */}
            <SkeletonBlock className="h-4 w-56" />
          </header>
          <CardListSkeleton count={3} />
        </div>
      </div>
    </SkeletonExit>
  );
}
