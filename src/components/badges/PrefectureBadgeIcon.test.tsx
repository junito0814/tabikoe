import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrefectureBadgeIcon, PREFECTURE_BADGE_SIZE } from "./PrefectureBadgeIcon";
import { prefectureMotif } from "@/lib/badges/prefecture-motifs";

/**
 * 出典: docs/tasks/badges/prefecture-motifs/02-badge-icon-ui.md 単体テスト
 * 要件定義書 4.5.20・8 章 101・102
 *
 * 【初心者向け】絵の見た目は目で見るしかないので、ここでは**枠と入れ物**を見ます ──
 * 層がすべて描かれているか、文字が入っていないか、絵が無い県で何も返さないか。
 */
const svg = (markup: HTMLElement) => markup.querySelector("svg");

describe("PrefectureBadgeIcon（#977）", () => {
  it("層の数だけ path を描く", () => {
    const motif = prefectureMotif("北海道")!;
    const { container } = render(<PrefectureBadgeIcon prefecture="北海道" />);
    expect(container.querySelectorAll("g path")).toHaveLength(motif.layers.length);
  });

  it("金の二重の輪を描く（メダルに見せるため）", () => {
    const { container } = render(<PrefectureBadgeIcon prefecture="京都府" />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute("r")).toBe("47");
    expect(circles[1].getAttribute("r")).toBe("38");
    for (const circle of circles) expect(circle.getAttribute("stroke")).toBe("#d4a52a");
  });

  it("大きさの既定は 56px（48px では細かい絵が潰れた）", () => {
    const { container } = render(<PrefectureBadgeIcon prefecture="沖縄県" />);
    expect(PREFECTURE_BADGE_SIZE).toBe(56);
    expect(svg(container)?.getAttribute("width")).toBe("56");
  });

  it("大きさは渡せる（トーストでは 40px にする）", () => {
    const { container } = render(<PrefectureBadgeIcon prefecture="沖縄県" size={40} />);
    expect(svg(container)?.getAttribute("width")).toBe("40");
  });

  /**
   * **絵を持っていない県では何も描かない。** 呼ぶ側が 🏅 に落とすための作りで、
   * これが無いと 47 県が揃うまで画面を出せません（要件 8 章 102）。
   */
  it("絵が無い県名では何も描かない", () => {
    const { container } = render(<PrefectureBadgeIcon prefecture="東京" />);
    expect(container.innerHTML).toBe("");
  });

  it("絵の中に文字を入れない（規則 4）", () => {
    for (const prefecture of ["北海道", "東京都", "群馬県", "佐賀県"]) {
      const { container } = render(<PrefectureBadgeIcon prefecture={prefecture} />);
      expect(container.querySelectorAll("text")).toHaveLength(0);
    }
  });

  it("塗りは 22% に薄める（背景が透けるので、色を 2 組持たずに済む）", () => {
    const { container } = render(<PrefectureBadgeIcon prefecture="青森県" />);
    const filled = [...container.querySelectorAll("g path")].find((path) => path.getAttribute("fill") !== "none");
    expect(filled?.getAttribute("fill")).toMatch(/color-mix\(in srgb, #[0-9a-f]{6} 22%, transparent\)/);
  });
});
