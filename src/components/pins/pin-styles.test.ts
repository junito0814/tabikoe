/**
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/01-pin-types-and-icons.md（単体テスト）
 * 「優先順位関数が仕様どおりの種別を返すこと（saved＋post → saved、posted＋saved → posted）」
 */
import { describe, expect, it } from "vitest";
import { normalizePinType, resolvePinPriority } from "./pin-styles";

describe("resolvePinPriority", () => {
  it("SC-02 では保存済みがみんなの投稿より優先", () => {
    expect(resolvePinPriority("map", { hasPost: true, isSaved: true })).toBe("saved");
    expect(resolvePinPriority("map", { hasPost: true })).toBe("post");
  });
  it("SC-12 では投稿済みが保存済みより優先", () => {
    expect(resolvePinPriority("mymap", { isPosted: true, isSaved: true })).toBe("posted");
    expect(resolvePinPriority("mymap", { isSaved: true })).toBe("saved");
  });
  it("下書きは常に draft", () => {
    expect(resolvePinPriority("map", { isDraft: true, isSaved: true })).toBe("draft");
  });
});

describe("normalizePinType", () => {
  it("旧種別名を新しい名前に読み替える", () => {
    expect(normalizePinType("normal")).toBe("post");
    expect(normalizePinType("wishlist")).toBe("saved");
    expect(normalizePinType("posted")).toBe("posted");
  });
});
