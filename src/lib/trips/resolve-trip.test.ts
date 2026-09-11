import { describe, expect, it } from "vitest";
import {
  assertValidTripTitle,
  normalizeTripTitle,
  TripTitleValidationError,
} from "./resolve-trip";
import { MAX_TRIP_TITLE_LENGTH } from "./constants";

/**
 * 出典: docs/tasks/posts/trip-title/02-trip-resolution-logic.md 単体テスト
 * 「前後に空白を含む入力がトリムされた上で完全一致判定されること」（要件定義書3.3.4）
 *
 * resolveTripId自体はDBアクセスを伴うため結合テストの対象。
 * ここではその前段の正規化と検証のみを検証する。
 */
describe("normalizeTripTitle", () => {
  it("前後の空白を除去する", () => {
    expect(normalizeTripTitle("  沖縄 2泊3日  ")).toBe("沖縄 2泊3日");
  });

  it("語中の空白は保持する（完全一致の対象）", () => {
    expect(normalizeTripTitle("沖縄  2泊3日")).toBe("沖縄  2泊3日");
  });

  it("全角スペースも除去する", () => {
    expect(normalizeTripTitle("　京都　")).toBe("京都");
  });
});

describe("assertValidTripTitle", () => {
  it("通常のタイトルは通る", () => {
    expect(() => assertValidTripTitle("北海道 冬")).not.toThrow();
  });

  it("空文字は拒否する", () => {
    expect(() => assertValidTripTitle("")).toThrow(TripTitleValidationError);
    expect(() => assertValidTripTitle("")).toThrow("trip_title_required");
  });

  it("上限ちょうど（200文字）は通る", () => {
    expect(() => assertValidTripTitle("あ".repeat(MAX_TRIP_TITLE_LENGTH))).not.toThrow();
  });

  it("上限超過（201文字）は拒否する", () => {
    expect(() => assertValidTripTitle("あ".repeat(MAX_TRIP_TITLE_LENGTH + 1))).toThrow(
      "trip_title_too_long"
    );
  });

  it("文字数は書記素クラスタ単位で数える（絵文字200個は通る）", () => {
    // コードユニット数では400になるが、書記素では200
    expect(() => assertValidTripTitle("😀".repeat(MAX_TRIP_TITLE_LENGTH))).not.toThrow();
  });
});
