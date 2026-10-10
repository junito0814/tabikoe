import { DelayedSkeleton, GridSkeleton } from "@/components/skeleton/Skeletons";

/**
 * #900（2026-10-09）: 画面を移るときの骨組み
 * 出典: Issue #900「画面を移るたびに 2 秒待つ」
 *       要件定義書 4.5.11 の場面 2（骨組みは本物と同じ形にする）
 *
 * 【初心者向け】`loading.tsx` が無いと、Next.js は**前の画面を出したまま**次の HTML を待つ。
 * 白くはならないが、利用者には「押したのに何も起きない」と見える。本番の実測で、冷えた関数が
 * 立ち上がるのに 2.44 秒かかっていた（温まっていれば 0.21 秒）。その間ずっと無反応に見えていた。
 *
 * この画面: SC-21 アルバムの写真一覧（正方形のグリッド）
 */
export default function Loading() {
  return <DelayedSkeleton><GridSkeleton rows={4} /></DelayedSkeleton>;
}
