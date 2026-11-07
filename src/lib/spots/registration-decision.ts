import type { NearbySpot } from "./nearby";

/**
 * #1062: スポットを登録するとき、「既存のスポットを使うか、新しく作るか」の判断
 * 出典: Issue #1062（Google の候補を選んでも、50m 以内にある別の店に置き換わる）
 *       要件定義書 3.3.5「重複登録の防止」
 *
 * 【初心者向け】なぜこの判断を切り出すのか。
 *   前は「50m 以内に登録済みのスポットがあれば、それを返す」だけでした。
 *   地図のピンで場所を指すとき（名前が無く、距離でしか同じ場所か分からない）はこれで正しいのですが、
 *   **Google の候補には Place ID（場所ごとに違う番号）があり、どの店かがもう決まっています**。
 *   それでも距離だけで判断していたので、同じビルの 3 階の「居酒屋 A」を選んでも、
 *   1 階の「ラーメン B」（登録済み）に置き換わっていました。
 *
 *   判断を画面やデータベースの取り方から切り離しておくと、ここだけをテストすれば済みます（約束 13）。
 *
 * 決まり（上から順に見る）
 *   1. Place ID があり、同じ Place ID のスポットが登録済み → それを使う（本当の重複。距離は問わない）
 *   2. Place ID があるが、同じ Place ID のスポットは無い   → **近くにあっても新しく作る**
 *      - 近くのスポットに別の Place ID がある：別の店なので寄せない
 *      - 近くのスポットが手動登録（Place ID なし）：同じ場所か分からないので寄せない。
 *        重複が残るかもしれないが、別の店に紐づくよりは害が小さい
 *   3. Place ID が無い（地図のピンだけで指した）→ 今までどおり、50m 以内にあればそれを使う
 */
export type SpotRegistrationDecision =
  | { kind: "existing"; spot: NearbySpot; reason: "same_place_id" | "nearby" }
  | { kind: "create" };

export function decideSpotRegistration(input: {
  /** 登録しようとしている場所の Place ID。手動登録（地図のピン）なら null */
  placeId: string | null;
  /** 同じ Place ID で登録済みのスポット。placeId が null のときは見ない */
  samePlaceSpot: NearbySpot | null;
  /** 半径 50m 以内の登録済みスポット（近い順） */
  nearby: NearbySpot[];
}): SpotRegistrationDecision {
  if (input.placeId !== null) {
    return input.samePlaceSpot ? { kind: "existing", spot: input.samePlaceSpot, reason: "same_place_id" } : { kind: "create" };
  }
  const closest = input.nearby[0];
  return closest ? { kind: "existing", spot: closest, reason: "nearby" } : { kind: "create" };
}
