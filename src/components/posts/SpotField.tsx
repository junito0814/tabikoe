"use client";

import { useState } from "react";
import { SpotAutocompleteInput } from "@/components/spots/SpotAutocompleteInput";
import type { NearbySpot } from "@/lib/spots/nearby";
import type { RegisteredSpot } from "@/lib/spots/types";

/** 「新しい場所」の表示名（要件定義書 v3.0 3.3.5） */
export const NEW_PLACE_LABEL = "この場所（新しい場所）";

/**
 * spot-selection-v3 Task4: スポット名欄（自動解決・「変更」からの候補検索・「この付近の新しい場所」）
 * 出典: docs/tasks/posts/spot-selection-v3/04-change-spot-by-name.md
 *       要件定義書 v3.0 3.3.5「スポット名欄」
 *
 * 【初心者向け】スポットの決まり方は 3 段階ある。
 *   1. lockedSpot（固定）: 入口で指定された／「変更」の検索で選んだスポット。地図を動かしても位置は変わらない
 *   2. resolvedSpot（自動）: 地図の中心から 50m 以内に見つかった登録済みスポット。名前を出すだけで、地図は動かせる
 *   3. どちらも無い: 「この場所（新しい場所）」。任意で名前を付けられる
 * 「変更」で名前検索に切り替え、候補を選ぶと 1 になる。「この付近の新しい場所」で固定を外して 3 に戻す
 * （地図はその候補の位置のまま。現地にいなくても登録の無い場所を決められる）。
 */
export function SpotField({
  lockedSpot,
  resolvedSpot,
  newPlaceName,
  onLock,
  onUnlock,
  onNewPlaceNameChange,
  searchSpots,
}: {
  lockedSpot: RegisteredSpot | null;
  resolvedSpot: NearbySpot | null;
  newPlaceName: string;
  /** 候補を選んだ（位置を固定する） */
  onLock: (spot: RegisteredSpot) => void;
  /** 固定を外して中央固定ピンに戻す。`keepPosition` は選んでいたスポットの位置に地図を置いたままにする */
  onUnlock: (keepPosition: LatLngLike | null) => void;
  onNewPlaceNameChange: (name: string) => void;
  searchSpots?: React.ComponentProps<typeof SpotAutocompleteInput>["searchSpots"];
}) {
  const [isSearching, setIsSearching] = useState(false);

  if (isSearching) {
    return (
      <div className="flex w-full items-start gap-2">
        <span className="w-[84px] shrink-0 pt-3 text-[12px] font-medium text-muted">スポット名 *</span>
        <div className="min-w-0 flex-1">
          <SpotAutocompleteInput
            selectedSpot={null}
            onSelect={(spot) => {
              if (spot) onLock(spot);
              setIsSearching(false);
            }}
            searchSpots={searchSpots}
            onCancel={() => setIsSearching(false)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              onUnlock(null);
              setIsSearching(false);
            }}
            className="mt-2 text-[12px] font-medium text-accent underline underline-offset-2"
          >
            新しい場所（ピンの位置）にする
          </button>
        </div>
      </div>
    );
  }

  const name = lockedSpot?.name ?? resolvedSpot?.name ?? NEW_PLACE_LABEL;
  const isNewPlace = !lockedSpot && !resolvedSpot;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="spot-field-name" className="w-[84px] shrink-0 text-[12px] font-medium text-muted">
          スポット名 *
        </label>
        <div
          id="spot-field-name"
          className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] border bg-surface px-3 text-[14px] text-ink ${
            lockedSpot ? "border-accent" : "border-line"
          }`}
          data-spot-field={lockedSpot ? "locked" : resolvedSpot ? "resolved" : "new"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-accent">
            <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <button type="button" onClick={() => setIsSearching(true)} className="shrink-0 text-[12px] font-medium text-accent underline underline-offset-2">
            変更
          </button>
        </div>
      </div>
      {lockedSpot && (
        <button
          type="button"
          onClick={() => onUnlock({ lat: lockedSpot.lat, lng: lockedSpot.lng })}
          className="self-end text-[11px] font-medium text-muted underline underline-offset-2"
        >
          この付近の新しい場所
        </button>
      )}
      {isNewPlace && (
        <div className="flex items-center gap-2">
          <span className="w-[84px] shrink-0 text-[11px] text-muted">場所の名前</span>
          <input
            value={newPlaceName}
            onChange={(event) => onNewPlaceNameChange(event.target.value)}
            placeholder="任意（例: 〇〇展望台）"
            aria-label="新しい場所の名前（任意）"
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}
    </div>
  );
}

export interface LatLngLike {
  lat: number;
  lng: number;
}
