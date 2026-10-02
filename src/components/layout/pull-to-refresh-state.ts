/**
 * loading-feedback Task 9: 引っ張って更新の「判断」
 * 出典: docs/tasks/shared-ui/loading-feedback/09-pull-to-refresh.md
 *       要件定義書 4.5.11 の場面 6・8 章 96
 *
 * 【初心者向け】ホーム画面から単独のアプリとして開くと、ブラウザの枠ごと
 * 「引っ張って更新」も消える（実機で確認）。アドレスバーも再読み込みボタンも
 * 無いので、**自分で最新にする手段が 1 つも無くなる**。その穴を塞ぐ。
 *
 * 指の動きそのものはブラウザの仕組みなので機械で再現しにくい。
 * そこで**判断だけを純粋関数に切り出して**ここでテストする（約束 13）。
 * 画面側（PullToRefresh.tsx）は、ここが返した答えをそのまま使うだけにする。
 */

/** これを超えて離したら取り直す（px）。実機で調整する前提の値 */
export const PULL_THRESHOLD_PX = 60;

/**
 * 指を引いた距離から、歯車を下ろす距離を決める（px）。
 *
 * 【初心者向け】指の動きをそのまま使うと**軽すぎて誤爆する**（少し下に払っただけで
 * 更新が走ると「勝手に読み込み直す壊れたアプリ」に見える）。
 * そこで指の動きの 1/2 だけ動かし、上限も付ける（引けば引くほど重くなる感じを出す）。
 */
export const PULL_RESISTANCE = 2;
/** 歯車を下ろせる上限（px）。これ以上引いても下がらない */
export const PULL_MAX_PX = 96;

export function pullDistance(startY: number, currentY: number): number {
  const moved = currentY - startY;
  // 上に動かしたぶんは無視する（0 より小さくしない）
  if (moved <= 0) return 0;
  return Math.min(moved / PULL_RESISTANCE, PULL_MAX_PX);
}

/**
 * いま引きはじめてよいか。
 *
 * - **いちばん上にいるときだけ**（途中で下に払っただけで更新させない）
 * - すでに取り直している間は受け付けない（二重に走らせない）
 */
export function canStartPull({ scrollTop, isRefreshing }: { scrollTop: number; isRefreshing: boolean }): boolean {
  if (isRefreshing) return false;
  // iOS は跳ね返りで scrollTop が負になることがあるので「0 以下」で見る
  return scrollTop <= 0;
}

/** 離したときに取り直すか */
export function shouldRefresh(distance: number): boolean {
  return distance >= PULL_THRESHOLD_PX;
}

/**
 * 歯車の回転角（度）。
 *
 * 【初心者向け】引いた距離に比例して回す。しきい値に届いた時点でちょうど
 * 1 回転（360 度）になるようにしてあるので、**一周したら離せばよい**と体で分かる。
 */
export function gearRotation(distance: number): number {
  return (distance / PULL_THRESHOLD_PX) * 360;
}

/** 歯車の濃さ（0〜1）。引きはじめは薄く、しきい値でちょうど 1 になる */
export function gearOpacity(distance: number): number {
  return Math.min(distance / PULL_THRESHOLD_PX, 1);
}
