/** `spots`に登録済みのスポット。投稿にはこのidを紐づける。 */
export interface RegisteredSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  source: "places" | "manual";
}
