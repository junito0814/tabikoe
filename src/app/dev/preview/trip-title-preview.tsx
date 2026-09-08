"use client";

import { useState } from "react";
import { TripTitleInput, type TripSuggestion } from "@/components/trips/TripTitleInput";

const SAMPLE_TRIPS: TripSuggestion[] = [
  { id: "1", title: "沖縄 2泊3日" },
  { id: "2", title: "京都ひとり旅" },
  { id: "3", title: "北海道 冬" },
];

/**
 * 【一時的な開発用プレビュー】TripTitleInputの目視確認用。
 * 未ログインでも動かせるよう、候補取得はサンプルデータに差し替えている。
 */
export default function TripTitlePreview() {
  const [value, setValue] = useState("");

  return (
    <TripTitleInput
      value={value}
      onChange={setValue}
      fetchSuggestions={async (query) =>
        SAMPLE_TRIPS.filter((trip) => trip.title.includes(query))
      }
    />
  );
}
