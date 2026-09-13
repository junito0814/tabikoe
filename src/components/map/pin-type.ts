import type { PinType } from "@/components/pins/pin-styles";
import type { MapPinData, MapView } from "@/lib/map/get-map-pins";

/**
 * F-MP-01 Task4: ピン種別表示・優先順位ルールの統合
 * 出典: docs/tasks/map-search/map-display/04-pin-type-integration.md
 *       要件定義書3.4.1・4.5.3
 *
 * 「全体」タブは公開投稿があるスポットの一覧なので、常に通常ピン（normal）で描く。
 * 自分の投稿があり、同時に「行きたい」保存もしているスポットも、「全体」タブ上では
 * wishlist ではなく normal（3.4.1「投稿済みかつ行きたいの場合」。マイマップ3.6.5と同一ルール）。
 * 「行きたい」タブは自分の保存分のみの一覧なので wishlist で描く。
 * `posted`（投稿済み）を使うのはマイマップ（SC-12、F-RC-06）だけで、SC-02 では出さない。
 */
export function resolveMapPinType(
  view: MapView,
  pin: Pick<MapPinData, "hasOwnPost" | "isWishlisted">
): PinType {
  if (view === "wishlist") {
    return "wishlist";
  }
  // hasOwnPost / isWishlisted の組み合わせに関わらず normal
  void pin;
  return "normal";
}
