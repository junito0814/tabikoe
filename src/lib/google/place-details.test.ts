import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPlaceOfficialInfo, hasOfficialInfo } from "./place-details";
import { PlacesApiError } from "./places";

/**
 * 出典: #701（スポット別の画面に営業時間と公式サイトを出す）単体テスト
 * 要件定義書 6.2・3.4.2
 *
 * 【初心者向け】いちばん大事なのは **引く項目を増やしていないこと**。
 * `regularOpeningHours` と `websiteUri` 以外を足すと、料金の段が上がり
 * 無料枠（月 1,000 回）の意味が変わる。だから FieldMask を固定で見張る。
 */
const originalKey = process.env.GOOGLE_PLACES_API_KEY;

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
});

afterEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn<(url: string, options?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>>(
    async () => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** 1 回目の呼び出しに渡した設定を取り出す（呼ばれていなければ落とす） */
function optionsOfFirstCall(fetchMock: ReturnType<typeof stubFetch>): RequestInit {
  const options = fetchMock.mock.calls[0]?.[1];
  if (!options) throw new Error("fetch が呼ばれていない");
  return options;
}

describe("fetchPlaceOfficialInfo", () => {
  it("営業中かどうか・曜日ごとの営業時間・公式サイトを返す", async () => {
    stubFetch({
      regularOpeningHours: { openNow: true, weekdayDescriptions: ["月曜日: 24 時間営業"] },
      websiteUri: "https://inari.jp/",
    });
    const info = await fetchPlaceOfficialInfo("ChIJ-abc");
    expect(info).toEqual({
      openNow: true,
      weekdayDescriptions: ["月曜日: 24 時間営業"],
      websiteUri: "https://inari.jp/",
    });
  });

  it("引く項目は営業時間と公式サイトだけ（料金の段を上げない）", async () => {
    const fetchMock = stubFetch({});
    await fetchPlaceOfficialInfo("ChIJ-abc");
    const headers = optionsOfFirstCall(fetchMock).headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe("regularOpeningHours,websiteUri");
  });

  it("保存しない（キャッシュを使わない）", async () => {
    const fetchMock = stubFetch({});
    await fetchPlaceOfficialInfo("ChIJ-abc");
    expect(optionsOfFirstCall(fetchMock).cache).toBe("no-store");
  });

  it("項目が無ければ null と空の配列にする（落ちない）", async () => {
    stubFetch({});
    expect(await fetchPlaceOfficialInfo("ChIJ-abc")).toEqual({
      openNow: null,
      weekdayDescriptions: [],
      websiteUri: null,
    });
  });

  it("鍵が無ければ PlacesApiError", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(fetchPlaceOfficialInfo("ChIJ-abc")).rejects.toBeInstanceOf(PlacesApiError);
  });

  it("Google が失敗を返したら PlacesApiError", async () => {
    stubFetch({}, { ok: false, status: 503 });
    await expect(fetchPlaceOfficialInfo("ChIJ-abc")).rejects.toBeInstanceOf(PlacesApiError);
  });
});

describe("hasOfficialInfo", () => {
  it("1 つでもあれば出す", () => {
    expect(hasOfficialInfo({ openNow: null, weekdayDescriptions: [], websiteUri: "https://x.test/" })).toBe(true);
    expect(hasOfficialInfo({ openNow: false, weekdayDescriptions: [], websiteUri: null })).toBe(true);
  });

  it("何も無ければ黙って出さない", () => {
    expect(hasOfficialInfo({ openNow: null, weekdayDescriptions: [], websiteUri: null })).toBe(false);
  });
});
