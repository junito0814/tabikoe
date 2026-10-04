import { describe, expect, it, vi } from "vitest";
import { hardRedirect } from "./hard-redirect";

/**
 * 出典: #705（6 桁を通しても管理画面に入れず、同じ画面に戻る）単体テスト
 *
 * 【初心者向け】見張っているのは「**ルーターを使っていないこと**」。
 * `router.replace` に戻すと、ブラウザにとどまっている「飛ばす」結果が使われて
 * また元の画面へ戻ってしまう（#705 の原因）。
 */
describe("hardRedirect", () => {
  it("画面ごと読み込み直す（location.assign を呼ぶ）", () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { assign }, writable: true, configurable: true });
    try {
      hardRedirect("/admin");
      expect(assign).toHaveBeenCalledWith("/admin");
    } finally {
      Object.defineProperty(window, "location", { value: original, writable: true, configurable: true });
    }
  });
});
