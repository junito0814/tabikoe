import { describe, expect, it } from "vitest";
import { keyboardInset, KEYBOARD_THRESHOLD_PX } from "./use-keyboard-inset";

/** 出典: Issue #803「コメントの入力欄を画面の下に固定する」 */
describe("keyboardInset（#803）", () => {
  it("キーボードが出ていなければ 0", () => {
    expect(keyboardInset({ offsetTop: 0, height: 844 }, 844)).toBe(0);
  });

  it("キーボードの高さぶんを返す", () => {
    expect(keyboardInset({ offsetTop: 0, height: 480 }, 844)).toBe(364);
  });

  it("画面がずれている（offsetTop がある）ときも、下に隠れている分だけ返す", () => {
    expect(keyboardInset({ offsetTop: 100, height: 400 }, 844)).toBe(344);
  });

  it("アドレスバーの出入り程度の差（120px 以下）はキーボードとみなさない", () => {
    expect(keyboardInset({ offsetTop: 0, height: 844 - KEYBOARD_THRESHOLD_PX }, 844)).toBe(0);
    expect(keyboardInset({ offsetTop: 0, height: 844 - KEYBOARD_THRESHOLD_PX - 1 }, 844)).toBe(KEYBOARD_THRESHOLD_PX + 1);
  });

  it("visualViewport が無い環境（古いブラウザ・サーバー）では 0", () => {
    expect(keyboardInset(null, 844)).toBe(0);
    expect(keyboardInset(undefined, 844)).toBe(0);
  });
});
