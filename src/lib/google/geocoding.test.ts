import { afterEach, describe, expect, it, vi } from "vitest";
import { extractGeocodedPlace, geocodePlace, GeocodingApiError } from "./geocoding";

/**
 * 出典: docs/tasks/map-search/place-search/01-geocode-handler.md 単体テスト
 * - Geocoding APIレスポンス（モック）から緯度経度を抽出するロジックを検証する
 * - APIエラー時に適切なエラーレスポンスを返すことを検証する
 */
describe("extractGeocodedPlace", () => {
  it("最初の結果の緯度経度と整形済み住所を返す", () => {
    const place = extractGeocodedPlace({
      status: "OK",
      results: [
        {
          formatted_address: "日本、〒100-0005 東京都千代田区丸の内１丁目",
          geometry: { location: { lat: 35.6812, lng: 139.7671 } },
        },
        { geometry: { location: { lat: 0, lng: 0 } } },
      ],
    });
    expect(place).toEqual({
      lat: 35.6812,
      lng: 139.7671,
      formattedAddress: "日本、〒100-0005 東京都千代田区丸の内１丁目",
    });
  });

  it("ZERO_RESULTS は null", () => {
    expect(extractGeocodedPlace({ status: "ZERO_RESULTS", results: [] })).toBeNull();
  });

  it("座標が数値でなければ null", () => {
    expect(
      extractGeocodedPlace({ status: "OK", results: [{ geometry: { location: { lat: "x" } } }] })
    ).toBeNull();
  });

  it("OK 以外のステータスは GeocodingApiError", () => {
    expect(() => extractGeocodedPlace({ status: "REQUEST_DENIED" })).toThrow(GeocodingApiError);
  });
});

describe("geocodePlace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("HTTPエラー時は GeocodingApiError を投げる", async () => {
    vi.stubEnv("GOOGLE_GEOCODING_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(geocodePlace("東京駅")).rejects.toBeInstanceOf(GeocodingApiError);
  });

  it("APIキー未設定は GeocodingApiError（キーをフロントに渡さずサーバーでのみ扱う）", async () => {
    vi.stubEnv("GOOGLE_GEOCODING_API_KEY", "");
    await expect(geocodePlace("東京駅")).rejects.toBeInstanceOf(GeocodingApiError);
  });

  it("キーはクエリの key パラメータとしてサーバーからのみ送る", async () => {
    vi.stubEnv("GOOGLE_GEOCODING_API_KEY", "server-only-key");
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () =>
      Response.json({ status: "OK", results: [{ geometry: { location: { lat: 1, lng: 2 } } }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePlace("東京駅")).resolves.toMatchObject({ lat: 1, lng: 2 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("key=server-only-key");
    expect(url).toContain("address=");
  });
});
