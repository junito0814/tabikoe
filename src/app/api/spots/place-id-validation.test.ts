import { describe, expect, it } from "vitest";
import { parseConfirmedPrefecture, parsePlaceId } from "./route";

/**
 * 出典: #700（place_id を保存し、スポットの値を「利用者が確定したもの」にする）単体テスト
 * 要件定義書 6.2
 */
describe("parsePlaceId", () => {
  it("文字列はそのまま受け取る（前後の空白は落とす）", () => {
    expect(parsePlaceId("  ChIJ-abc  ")).toBe("ChIJ-abc");
  });

  it("無い・空は「無し」として扱う（手動登録には Place ID が無い）", () => {
    expect(parsePlaceId(undefined)).toBeNull();
    expect(parsePlaceId(null)).toBeNull();
    expect(parsePlaceId("   ")).toBeNull();
  });

  it("文字列でないもの・長すぎるものは断る", () => {
    expect(parsePlaceId(123)).toBe("invalid");
    expect(parsePlaceId({})).toBe("invalid");
    expect(parsePlaceId("a".repeat(256))).toBe("invalid");
  });
});

describe("parseConfirmedPrefecture", () => {
  it("47 の名前なら受け取る", () => {
    expect(parseConfirmedPrefecture("京都府")).toBe("京都府");
    expect(parseConfirmedPrefecture("北海道")).toBe("北海道");
  });

  it("無い・空は「無し」（サーバーが逆引きする）", () => {
    expect(parseConfirmedPrefecture(undefined)).toBeNull();
    expect(parseConfirmedPrefecture("")).toBeNull();
  });

  /**
   * 【初心者向け】自由入力をそのまま保存すると、都道府県バッジの集計が合わなくなる
   * （「京都」と「京都府」が別物になる）。だから 47 の名前に限る。
   */
  it("47 に無い名前は断る", () => {
    expect(parseConfirmedPrefecture("京都")).toBe("invalid");
    expect(parseConfirmedPrefecture("どこか")).toBe("invalid");
    expect(parseConfirmedPrefecture(7)).toBe("invalid");
  });
});
