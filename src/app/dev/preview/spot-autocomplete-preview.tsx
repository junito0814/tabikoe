"use client";

import { useState } from "react";
import { SpotAutocompleteInput, type SpotCandidate } from "@/components/spots/SpotAutocompleteInput";
import type { RegisteredSpot } from "@/lib/spots/types";

const SAMPLE_CANDIDATES: SpotCandidate[] = [
  { id: "s1", name: "首里城", lat: 26.217, lng: 127.719, source: "manual", postCount: 12, placeId: null },
  { id: null, name: "首里城公園", lat: 26.2168, lng: 127.7194, source: "places", postCount: 0, placeId: "ChIJ-preview" },
];

/**
 * 【一時的な開発用プレビュー】SpotAutocompleteInputの目視確認用。
 * 未ログインでも動かせるよう、検索はサンプルデータに差し替えている
 * （候補選択後の登録APIは実際に呼ばれるため、未ログインではログイン画面へ誘導される）。
 */
export default function SpotAutocompletePreview() {
  const [spot, setSpot] = useState<RegisteredSpot | null>(null);

  return (
    <SpotAutocompleteInput
      selectedSpot={spot}
      onSelect={setSpot}
      searchSpots={async (query) => ({
        candidates: SAMPLE_CANDIDATES.filter((candidate) => candidate.name.includes(query)),
        placesUnavailable: false,
      })}
    />
  );
}
