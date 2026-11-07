import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { googleApiUrl } from "./base-url";

/**
 * 出典: docs/tasks/shared-ui/e2e-foundation/04-maps-stub.md「テスト要件 › 単体テスト」
 */
describe("googleApiUrl", () => {
  it("基点が未設定なら本物の URL を返す", () => {
    expect(googleApiUrl("places", "/v1/places:searchText", undefined)).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(googleApiUrl("maps", "/maps/api/geocode/json", "")).toBe("https://maps.googleapis.com/maps/api/geocode/json");
    expect(googleApiUrl("routes", "/distanceMatrix/v2:computeRouteMatrix", "  ")).toBe(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
    );
  });

  it("手元のアドレスが設定されていれば、それを基点にする（末尾の / は 1 つにまとめる）", () => {
    expect(googleApiUrl("places", "/v1/places", "http://127.0.0.1:3199")).toBe("http://127.0.0.1:3199/places/v1/places");
    expect(googleApiUrl("maps", "/maps/api/geocode/json", "http://localhost:3199/")).toBe(
      "http://localhost:3199/maps/maps/api/geocode/json"
    );
  });

  it("手元以外のアドレスは無視して本物を使う（API キーを外のサーバーに渡さない）", () => {
    for (const base of ["https://evil.example.com", "http://192.168.0.10:3199", "https://127.0.0.1:3199", "not a url"]) {
      expect(googleApiUrl("places", "/v1/places", base)).toBe("https://places.googleapis.com/v1/places");
    }
  });
});

describe("Google を呼ぶ 4 ファイル", () => {
  it("URL を基点（googleApiUrl）を通して組み立てていて、googleapis.com の直書きが残っていない", () => {
    for (const name of ["places.ts", "place-details.ts", "geocoding.ts", "routes.ts"]) {
      const source = readFileSync(join(__dirname, name), "utf8");
      expect(source, name).not.toMatch(/googleapis\.com/);
      expect(source, name).toMatch(/googleApiUrl\(/);
    }
  });
});
