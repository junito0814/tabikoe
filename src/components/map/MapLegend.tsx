"use client";

import { PinIcon } from "@/components/pins/PinIcon";
import { DAY_PIN_COLORS } from "@/components/pins/pin-styles";

/**
 * pin-display-rules-v3 Task2: 地図の凡例
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/02-map-legend.md
 *       要件定義書 v3.0 4.5.3（凡例を地図上に常時表示する）
 *
 * 【初心者向け】地図にはタブが無いので、「青＝みんなの投稿、赤＝保存済み、灰の破線＝下書き」を
 * 常に見せておく必要がある。しおり表示のときは Day ごとの色に切り替える。
 * 色だけでなく形（丸／ひし形／破線）でも分かるよう、PinIcon をそのまま小さく並べる。
 */
export function MapLegend({
  mode = "default",
  dayCount = 0,
  className,
}: {
  mode?: "default" | "itinerary";
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
      : [
          { key: "post", icon: <PinIcon type="post" size={16} />, label: "みんなの投稿" },
          { key: "saved", icon: <PinIcon type="saved" size={16} />, label: "保存済み" },
          { key: "draft", icon: <PinIcon type="draft" size={16} />, label: "下書き" },
        ];

  return (
    <div
      role="list"
      aria-label="ピンの凡例"
      data-map-legend={mode}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] bg-surface/92 px-2.5 py-1.5 text-[10px] text-ink shadow-card ${className ?? ""}`}
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
