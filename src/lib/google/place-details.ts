import { PlacesApiError } from "./places";

/**
 * #701: Place Details（New）で**営業時間と公式サイトだけ**を引く
 * 出典: 要件定義書 6.2「Google から借りるものの方針」・3.4.2「公式情報」
 *
 * 【初心者向け】ここで引いたものは**保存しません。** 規約が業者名・住所・クチコミの
 * 保存を禁じているため（§3.2.3(a)(iii)）、画面を開くたびに引き直します。
 * 保存してよいのは `place_id` だけ（#700 でそれを保存した）。
 *
 * **引く項目を 2 つに絞っている理由** ── `regularOpeningHours` と `websiteUri` は
 * 料金のいちばん高い段（Enterprise）に入っていて、無料枠が**月 1,000 回**しかない。
 * スポット別の画面でだけ、1 画面 1 回引く（一覧に出すと 1 画面 20 回で月 50 画面で尽きる）。
 * ★・価格帯・写真・クチコミは**借りない**（タビコエが自前で持っている）。
 */
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

/** 画面に出す形。取れなかった項目は null／空になる */
export interface PlaceOfficialInfo {
  /** いま営業中か。Google が返さなければ null */
  openNow: boolean | null;
  /** 曜日ごとの営業時間（Google が作った日本語の文。7 行） */
  weekdayDescriptions: string[];
  /** 公式サイト。無ければ null */
  websiteUri: string | null;
}

interface DetailsResponse {
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  websiteUri?: string;
}

/** 空っぽ（出すものが何も無い）かどうか。画面側はこれで「黙って出さない」を判断する */
export function hasOfficialInfo(info: PlaceOfficialInfo): boolean {
  return info.openNow !== null || info.weekdayDescriptions.length > 0 || info.websiteUri !== null;
}

export async function fetchPlaceOfficialInfo(placeId: string): Promise<PlaceOfficialInfo> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesApiError("GOOGLE_PLACES_API_KEY is not set");
  }

  let response: Response;
  try {
    response = await fetch(`${DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        // 引く項目を絞ると料金の段も下がる。余分な項目を足さない
        "X-Goog-FieldMask": "regularOpeningHours,websiteUri",
        "Accept-Language": "ja",
      },
      // 保存禁止（§3.2.3(b)）。キャッシュせず毎回引く
      cache: "no-store",
    });
  } catch (error) {
    throw new PlacesApiError(error instanceof Error ? error.message : "request failed");
  }

  if (!response.ok) {
    throw new PlacesApiError(`Place Details responded with ${response.status}`);
  }

  const data = (await response.json()) as DetailsResponse;
  return {
    openNow: typeof data.regularOpeningHours?.openNow === "boolean" ? data.regularOpeningHours.openNow : null,
    weekdayDescriptions: Array.isArray(data.regularOpeningHours?.weekdayDescriptions)
      ? data.regularOpeningHours.weekdayDescriptions.filter((line): line is string => typeof line === "string")
      : [],
    websiteUri: typeof data.websiteUri === "string" && data.websiteUri.length > 0 ? data.websiteUri : null,
  };
}
