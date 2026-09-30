import { BRAND_GROUND } from "@/lib/theme/colors";

/**
 * brand-logo Task2（2026-09-26）: アプリのロゴ
 * 出典: 要件定義書 4.5.9「ロゴとファビコン」、docs/tasks/shared-ui/brand-logo/02-app-logo-in-screens.md
 *
 * 【初心者向け】ロゴは 3 つの画面（未ログインのホーム・ログイン済みのホーム・同意画面）に出る。
 * 前は画面ごとに同じ絵を書き写していたので、形がずれる元になっていた。ここ 1 つにまとめ、
 * 各画面はこれを呼ぶだけにする。中身は src/app/icon.svg（タブのアイコン）と同じ数値。
 *
 * 形の意味:
 *   白い丸い吹き出し ＝ コエ（声）／下に伸びる尾 ＝ 地図のピン／広がる 2 本の輪 ＝ 声の波紋
 *
 * 数値を変えるときの注意:
 *   吹き出しの縁は中心から 11.5〜15、内側の輪の内縁は 19.9 で、どの向きでも触れないようにしてある。
 *   触れると 16 ピクセル（タブの大きさ）でつながって 1 つの塊に見えてしまう。
 *   地の青は var(--accent) ではなく固定値。ダークモードでも明るい四角として見せたいので色を変えない（4.5.9）。
 *   地の青は 2026-09-30 に src/lib/theme/colors.ts へ移した（マニフェストでも同じ色を使うため。同じ値を 2 か所に書かない）。
 */

export function AppLogo({ size = 72 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden>
            <rect width="72" height="72" rx="20" fill={BRAND_GROUND} />
            <circle cx="36" cy="32.8" r="11.5" fill="#FFFFFF" />
            <path d="M32 42L36 51L40 42Z" fill="#FFFFFF" />
            <circle cx="36" cy="36" r="22" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="4.2" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="3.6" />
        </svg>
    );
}
