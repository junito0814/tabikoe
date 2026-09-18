/**
 * 出典: docs/tasks/posts/post-creation-v3/03-split-screen-layout.md（単体テスト）
 * 画面の入力 → API の JSON への変換（空文字は null、費用は数値）
 */
import { describe, expect, it } from "vitest";
import { buildComposePayload } from "./compose-payload";
import { EMPTY_POST_FORM_VALUES } from "./PostFormFields";

describe("buildComposePayload", () => {
  it("未入力は null、費用は数値、位置は lat/lng で送る", () => {
    const payload = buildComposePayload({
      status: "draft",
      values: { ...EMPTY_POST_FORM_VALUES, cost: "1200", comment: "よかった" },
      position: { lat: 35.6, lng: 139.7 },
      spotId: null,
      spotName: "  ",
      media: [],
    });
    expect(payload).toMatchObject({ status: "draft", category: null, duration: null, rating: null, cost: 1200, spotId: null, spotName: null, lat: 35.6, lng: 139.7, comment: "よかった" });
  });
  it("公開時はそのまま渡す", () => {
    const payload = buildComposePayload({
      status: "published",
      values: { ...EMPTY_POST_FORM_VALUES, tripTitle: "大阪旅行", category: "グルメ", duration: "1時間以内", rating: 4, visitDate: "2026-09-16" },
      position: { lat: 1, lng: 2 },
      spotId: "s1",
      spotName: "",
      media: [{ mediaType: "photo", storagePath: "p", videoPath: null, durationSeconds: null }],
    });
    expect(payload).toMatchObject({ status: "published", tripTitle: "大阪旅行", spotId: "s1", rating: 4, visitDate: "2026-09-16", media: [{ storagePath: "p" }] });
  });
});
