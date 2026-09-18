"use client";

import { PinIcon } from "./PinIcon";
import { getPinStyle, type AnyPinType } from "./pin-styles";

export interface MapPinProps {
  type: AnyPinType;
  onClick?: () => void;
}

/**
 * ピンの表示ルール Task2: 地図コンポーネントへのピン種別表示の組み込み
 * 出典: docs/tasks/shared-ui/pin-display-rules/02-map-pin-integration-interface.md
 *
 * 種別（normal/wishlist/posted）を受け取りアイコンを描画するインターフェース。
 * 実際のピン取得・地図表示ロジックは対象外（F-MP-01 地図表示、F-RC-06 マイマップの
 * 実装時に、それぞれがこのコンポーネントを組み込む）。
 */
export function MapPin({ type, onClick }: MapPinProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={getPinStyle(type).label}
      className="cursor-pointer border-none bg-transparent p-0"
    >
      <PinIcon type={type} />
    </button>
  );
}
