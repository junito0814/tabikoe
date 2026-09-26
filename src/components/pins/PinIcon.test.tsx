import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PinIcon } from "./PinIcon";
import { MapPin } from "./MapPin";
import { CATEGORY_PIN_STYLE, PIN_TYPE_LABELS, resolvePinLook, type PinType } from "./pin-styles";
import { POST_CATEGORIES } from "@/lib/posts/constants";

/**
 * 出典: docs/tasks/shared-ui/pin-display-rules/01-pin-icon-definitions.md 単体テスト
 *       docs/tasks/shared-ui/pin-categories/01-teardrop-and-category-icons.md 単体テスト
 * 「色情報を取り除いた状態でも判別可能であること」（要件 7.7）
 * 「カテゴリ 7 つ＋無しの色と記号が 4.5.3 の表どおりであること」
 */
const ALL_TYPES: PinType[] = ["post", "saved", "posted", "draft", "focus", "numbered", "cluster"];

describe("カテゴリの色と記号（4.5.3）", () => {
  it("7 つのカテゴリすべてに色と記号があり、どれも重ならない", () => {
    expect(Object.keys(CATEGORY_PIN_STYLE).sort()).toEqual([...POST_CATEGORIES].sort());
    const colors = POST_CATEGORIES.map((category) => CATEGORY_PIN_STYLE[category].color);
    const glyphs = POST_CATEGORIES.map((category) => CATEGORY_PIN_STYLE[category].glyph);
    expect(new Set(colors).size).toBe(POST_CATEGORIES.length);
    expect(new Set(glyphs).size).toBe(POST_CATEGORIES.length);
  });

  it("カテゴリが無ければ灰色の点になる", () => {
    const look = resolvePinLook("post", { category: null });
    expect(look.color).toEqual({ token: "pin-none" });
    expect(look.glyph).toBe("dot");
  });

  it("現在地の青（--accent）はピンの色に使わない（見分けが付かなくなるため）", () => {
    const tokens = POST_CATEGORIES.map((category) => CATEGORY_PIN_STYLE[category].color);
    expect(tokens).not.toContain("accent");
  });
});

describe("形と状態（4.5.3）", () => {
  it("スポットのピンはしずく型。クラスタだけ丸", () => {
    for (const type of ALL_TYPES) {
      expect(resolvePinLook(type).shape).toBe(type === "cluster" ? "circle" : "teardrop");
    }
  });

  it("保存済みはハート、自分の投稿はチェックのバッジ。それ以外は付かない", () => {
    expect(resolvePinLook("saved", { category: "グルメ" }).badge).toBe("heart");
    expect(resolvePinLook("posted", { category: "グルメ" }).badge).toBe("check");
    expect(resolvePinLook("post", { category: "グルメ" }).badge).toBeNull();
    expect(resolvePinLook("draft").badge).toBeNull();
  });

  it("保存済みでも色はカテゴリのまま（色は状態を表さない）", () => {
    expect(resolvePinLook("saved", { category: "宿泊施設" }).color).toEqual({ token: "pin-stay" });
  });

  it("下書きは破線、フォーカスは淡い輪が付く", () => {
    expect(resolvePinLook("draft").dashed).toBe(true);
    expect(resolvePinLook("focus", { category: "グルメ" }).halo).toBe(true);
  });

  it("しおりの番号ピンは しずく型で、色は Day ごと・済みは灰色", () => {
    const day2 = resolvePinLook("numbered", { dayIndex: 2, label: 3 });
    expect(day2.shape).toBe("teardrop");
    expect(day2.color).toEqual({ value: "#d9694a" });
    expect(resolvePinLook("numbered", { dayIndex: 2, done: true }).color).toEqual({ token: "muted" });
  });

  it("7 種別それぞれに異なるラベルが割り当てられている", () => {
    const labels = ALL_TYPES.map((type) => PIN_TYPE_LABELS[type]);
    expect(new Set(labels).size).toBe(ALL_TYPES.length);
  });
});

describe("PinIcon", () => {
  it("色を無視してもカテゴリごとの SVG 構造が互いに異なる（色に依存しない）", () => {
    const stripColors = (html: string) => html.replace(/(fill|stroke)="[^"]*"/g, "");
    const rendered = POST_CATEGORIES.map((category) => {
      const { container, unmount } = render(<PinIcon type="post" category={category} />);
      const html = stripColors(container.innerHTML);
      unmount();
      return html;
    });
    expect(new Set(rendered).size).toBe(POST_CATEGORIES.length);
  });

  it("色を無視しても状態（下書き・フォーカス・番号・クラスタ）が互いに異なる", () => {
    const stripColors = (html: string) => html.replace(/(fill|stroke)="[^"]*"/g, "");
    const rendered = (["post", "saved", "posted", "draft", "focus", "numbered", "cluster"] as PinType[]).map((type) => {
      const { container, unmount } = render(<PinIcon type={type} category="グルメ" label={1} dayIndex={1} />);
      const html = stripColors(container.innerHTML);
      unmount();
      return html;
    });
    expect(new Set(rendered).size).toBe(ALL_TYPES.length);
  });

  it("種別のラベルがアクセシブルネームとして付く", () => {
    render(<PinIcon type="saved" />);
    expect(screen.getByRole("img", { name: PIN_TYPE_LABELS.saved })).toBeInTheDocument();
  });
});

describe("MapPin（Task2）", () => {
  it.each(ALL_TYPES)("種別 %s に対応するラベルのボタンを描画する", (type) => {
    render(<MapPin type={type} />);
    expect(screen.getByRole("button", { name: PIN_TYPE_LABELS[type] })).toBeInTheDocument();
  });

  it("クリックでonClickが呼ばれる", () => {
    const onClick = vi.fn();
    render(<MapPin type="posted" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
