"use client";

import { useState, type FormEvent } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { GeocodedPlace } from "@/lib/google/geocoding";

/** 地名検索で移動した後のズーム。市区町村〜駅周辺が見える程度 */
export const PLACE_SEARCH_ZOOM = 14;

export type SearchPlaceResult =
  | { status: "found"; place: GeocodedPlace }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * F-MP-02 Task2: 検索バーUI
 * 出典: docs/tasks/map-search/place-search/02-search-bar-ui.md
 *
 * 入力された地名で GET /api/geocode を呼び、返った緯度経度を `onLocate` で親（地図画面）へ渡す。
 * 地図の移動だけを行い、投稿の絞り込み条件（F-MP-04）には一切触れない（3.4.2）。
 */
export function PlaceSearchBar({
  onLocate,
  searchPlace = defaultSearchPlace,
  className,
}: {
  onLocate: (place: GeocodedPlace) => void;
  /** 差し替え口（単体テスト用） */
  searchPlace?: (query: string) => Promise<SearchPlaceResult>;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0 || isSearching) return;

    setIsSearching(true);
    setMessage(null);
    try {
      const result = await searchPlace(trimmed);
      if (result.status === "found") {
        onLocate(result.place);
      } else if (result.status === "not_found") {
        setMessage("該当する地名が見つかりませんでした");
      } else {
        setMessage("地名検索が一時的に利用できません");
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setMessage("地名検索が一時的に利用できません");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={className}>
      <div className="flex h-11 items-center gap-2 rounded-full border border-[#E8E1D8] bg-white px-3.5 shadow-[0_2px_16px_rgba(61,58,53,0.10)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
          <circle cx="11" cy="11" r="7" stroke="#9C9488" strokeWidth="2" />
          <path d="M16.5 16.5L21 21" stroke="#9C9488" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="地名で地図を移動"
          aria-label="地名検索"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#3D3A35] placeholder:text-[#9C9488] focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSearching || query.trim().length === 0}
          className="shrink-0 text-[12px] font-semibold text-[#C4703F] disabled:opacity-45"
        >
          {isSearching ? "検索中…" : "移動"}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-1.5 px-3 text-[11px] text-[#C4703F]">
          {message}
        </p>
      )}
    </form>
  );
}

async function defaultSearchPlace(query: string): Promise<SearchPlaceResult> {
  const response = await fetchWithAuthRedirect(`/api/geocode?query=${encodeURIComponent(query)}`);
  if (response.status === 404) return { status: "not_found" };
  if (!response.ok) return { status: "unavailable" };
  const data = (await response.json()) as { place: GeocodedPlace };
  return { status: "found", place: data.place };
}
