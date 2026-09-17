import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PinIcon } from "./PinIcon";
import { MapPin } from "./MapPin";
import { PIN_STYLES, type PinType } from "./pin-styles";

/**
 * 出典: docs/tasks/shared-ui/pin-display-rules/01-pin-icon-definitions.md 単体テスト
 *       docs/tasks/shared-ui/pin-display-rules/02-map-pin-integration-interface.md 単体テスト
 * 「色情報を取り除いた状態でも3種別が形状・アイコンにより判別可能であること」（要件7.7）
 */
const ALL_TYPES: PinType[] = ["post", "saved", "posted", "draft", "focus", "numbered", "cluster"];

describe("PIN_STYLES（Task1）", () => {
  it("7種別それぞれが形状＋記号＋破線の組み合わせで判別できる（色に依存しない）", () => {
    const shapes = ALL_TYPES.map((type) => `${PIN_STYLES[type].shape}/${PIN_STYLES[type].glyph}/${PIN_STYLES[type].dashed ? "dashed" : "solid"}`);
    expect(new Set(shapes).size).toBe(ALL_TYPES.length);
  });

  it("7種別それぞれに異なるラベルが割り当てられている", () => {
    const labels = ALL_TYPES.map((type) => PIN_STYLES[type].label);
    expect(new Set(labels).size).toBe(ALL_TYPES.length);
  });

  it("みんなの投稿は青（accent）、保存済みは赤（saved）", () => {
    expect(PIN_STYLES.post.color).toBe("accent");
    expect(PIN_STYLES.saved.color).toBe("saved");
  });
});

describe("PinIcon（Task1）", () => {
  it("色を無視しても3種別のSVG構造が互いに異なる", () => {
    // 色属性（fill/stroke）を消した上で描画結果を比較する
    const stripColors = (html: string) => html.replace(/(fill|stroke)="[^"]*"/g, "");
    const rendered = ALL_TYPES.map((type) => {
      const { container, unmount } = render(<PinIcon type={type} />);
      const html = stripColors(container.innerHTML);
      unmount();
      return html;
    });
    expect(new Set(rendered).size).toBe(ALL_TYPES.length);
  });

  it("種別のラベルがアクセシブルネームとして付く", () => {
    render(<PinIcon type="saved" />);
    expect(screen.getByRole("img", { name: PIN_STYLES.saved.label })).toBeInTheDocument();
  });
});

describe("MapPin（Task2）", () => {
  it.each(ALL_TYPES)("種別 %s に対応するラベルのボタンを描画する", (type) => {
    render(<MapPin type={type} />);
    expect(screen.getByRole("button", { name: PIN_STYLES[type].label })).toBeInTheDocument();
  });

  it("クリックでonClickが呼ばれる", () => {
    const onClick = vi.fn();
    render(<MapPin type="posted" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
