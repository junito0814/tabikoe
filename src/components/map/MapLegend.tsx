"use client";

import { PinIcon } from "@/components/pins/PinIcon";
import { DAY_PIN_COLORS } from "@/components/pins/pin-styles";
import { TERMS } from "@/lib/terms";

/**
 * pin-display-rules-v3 Task2: 地図の凡例
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/02-map-legend.md
 *       要件定義書 v3.0 4.5.3（凡例を地図上に常時表示する）
 *
 * pin-categories Task1（2026-09-26）: 凡例が説明するのは**状態だけ**にした。
 * ピンの色はカテゴリを表すようになり（7 色）、凡例に並べると地図が埋まってしまうため。
 * カテゴリはピンの中の記号で分かり、名前はピンをタップした吹き出しで確かめられる。
 *
 * 【初心者向け】ここで PinIcon にカテゴリを渡していないのは意図的で、カテゴリ無し（灰色）の
 * ピンで「状態の違い（バッジ・破線）」だけを見せたいから。しおり表示のときは Day ごとの色に切り替える。
 */
export function MapLegend({
  mode = "default",
  dayCount = 0,
  className,
}: {
  mode?: "default" | "itinerary" | "mymap";
  /** itinerary モードのとき、色分けする Day の数 */
  dayCount?: number;
  className?: string;
}) {
  const items =
    mode === "itinerary"
      ? Array.from({ length: Math.max(1, dayCount) }, (_, i) => ({
          key: `day-${i + 1}`,
          icon: <PinIcon type="numbered" size={16} label={i + 1} dayIndex={i + 1} />,
          label: `Day ${i + 1}`,
        }))
      : mode === "mymap"
        ? [
            { key: "posted", icon: <PinIcon type="posted" size={16} />, label: "自分の投稿" },
            { key: "saved", icon: <PinIcon type="saved" size={16} />, label: TERMS.wishlist },
            { key: "draft", icon: <PinIcon type="draft" size={16} />, label: "下書き" },
          ]
        : [
            { key: "post", icon: <PinIcon type="post" size={16} />, label: "みんなの投稿" },
            { key: "saved", icon: <PinIcon type="saved" size={16} />, label: TERMS.wishlist },
            { key: "draft", icon: <PinIcon type="draft" size={16} />, label: "下書き" },
          ];

  return (
    <div
      role="list"
      aria-label="ピンの凡例"
      data-map-legend={mode}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] bg-surface/92 px-2.5 py-1.5 text-[0.625rem] text-ink shadow-card ${className ?? ""}`}
    >
      {items.map((item) => (
        <span key={item.key} role="listitem" className="inline-flex items-center gap-1">
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export { DAY_PIN_COLORS };
