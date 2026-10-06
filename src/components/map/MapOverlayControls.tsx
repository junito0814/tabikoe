import Link from "next/link";

/**
 * #760・#764（2026-10-06）: 上 1/3 の地図の右下に重ねる操作（「戻す」＋「全画面に」）
 * 出典: Issue #760「アプリ全体の地図ボタンを記号にそろえる」
 *       Issue #764「Bug 4: 上 1/3 の地図で Google のロゴがシートに半分隠れる」
 *
 * 【初心者向け】`StaticSpotMap`（スポット別一覧・投稿詳細）と `ItineraryStaticMap`（しおり詳細）に、
 * **まったく同じ塊が 2 つ**書かれていました。片方だけ直すとズレるので 1 つにまとめます（約束 14）。
 *
 * ## 「全画面に」は記号だけ
 *
 * 文字の「地図を全画面に」は 97px ありました。地図の上は場所が限られ、
 * **その下の情報（Google のロゴ・地図データの表記）を押しのけます**。
 * 広げる記号（↗↙）にして場所を空けます。読み上げでは「地図を全画面に」と読まれます（`aria-label`）。
 *
 * ## 「戻す」は文字のまま
 *
 * 出るのは**地図を動かしたときだけ**で、記号にすると「何が戻るのか」が分かりません。
 */
export function MapOverlayControls({ fullscreenHref, moved, onReset }: { fullscreenHref: string; moved: boolean; onReset: () => void }) {
  return (
    /*
     * #764: シート（MapSheetLayout）が地図の下端に 16px かぶさる。
     * ここはその分（12 + 16 = 28px）上げて隠れないようにしている。
     * **Google のロゴ**（地図の左下。規約で「見えていること」が要る）は地図の側で上げる ── `logoSafeClassName` 参照。
     */
    <div className="absolute right-3 bottom-7 z-10 flex items-center gap-2">
      {moved && (
        <button
          type="button"
          onClick={onReset}
          className="tap-target rounded-full bg-surface/90 px-2.5 py-1 text-[0.6875rem] font-medium text-ink shadow-[0_1px_4px_rgba(30,42,56,0.25)]"
        >
          戻す
        </button>
      )}
      <Link
        href={fullscreenHref}
        aria-label="地図を全画面に"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-on-ink"
      >
        {/* 四隅へ広がる矢印（全画面にする、の一般的な記号） */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * #764: Google のロゴをシートの重なりから逃がすための、地図そのものに当てる class。
 *
 * 【初心者向け】`MapSheetLayout` はシートを地図の下端に **16px かぶせます**（角の丸みを地図に食い込ませるため）。
 * 地図の側はその分を空けていなかったので、**左下の Google のロゴが半分隠れて**いました。
 * Google マップの規約は表記が「見えていること」を求めます ── 半分隠れているのは出していないのと同じです。
 *
 * 地図の**高さは変えず**、中の描画を 16px 上げます（`padding-bottom` ではなく、
 * 地図の要素そのものを上に詰めると下に 16px の帯ができるので、そこへシートが重なります）。
 */
export const LOGO_SAFE_CLASS = "pb-4";
