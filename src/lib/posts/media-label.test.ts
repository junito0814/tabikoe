import { describe, expect, it } from "vitest";
import { mediaLabel } from "./media-label";

describe("mediaLabel", () => {
  it("動画を受け付けているときは「写真・動画」", () => {
    expect(mediaLabel(true)).toBe("写真・動画");
  });

  it("動画を止めているときは「写真」", () => {
    expect(mediaLabel(false)).toBe("写真");
  });

  /*
   * #937: この関数は画面の見出し・追加ボタン・ファイル選択・空のときの文面を
   * **すべて同じ言葉から組み立てる**ための土台なので、返す値はこの 2 つだけに保つ。
   */
  it("返すのは 2 通りだけ", () => {
    expect(new Set([mediaLabel(true), mediaLabel(false)]).size).toBe(2);
  });
});
