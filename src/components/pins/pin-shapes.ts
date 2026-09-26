import type { PinGlyph, PinLook } from "./pin-styles";

/**
 * pin-categories Task1（2026-09-26）: ピンの図形そのもの
 * 出典: docs/tasks/shared-ui/pin-categories/01-teardrop-and-category-icons.md
 *       要件定義書 4.5.3
 *
 * 【初心者向け】ピンは 2 か所で描かれる。
 *   - 画面の中（凡例・一覧）… React（PinIcon.tsx）
 *   - 地図のマーカー … SVG を文字列で組んで画像（data URL）にする（pin-marker-icon.ts）
 * 図形を両方に書くとズレるので、ここで「どんな要素をどの属性で並べるか」を 1 回だけ決め、
 * 両者はその結果を描くだけにする。
 *
 * 座標は 32 × 32。しずくの先端が (16, 30.4)＝実際の座標を指す位置で、頭の中心は (16, 12.5)。
 */
export interface PinElement {
  tag: "path" | "circle" | "text";
  attrs: Record<string, string | number>;
  /** text のときの中身 */
  text?: string;
}

/** しずく型の輪郭（先端が下） */
export const TEARDROP_PATH = "M16 30.4c0 0-10-11.2-10-17.9C6 6.7 10.5 2.2 16 2.2s10 4.5 10 10.3c0 6.7-10 17.9-10 17.9z";

/** 頭の中心（記号はここを中心に描く） */
export const PIN_HEAD_CENTER = { x: 16, y: 12.5 } as const;

/** 記号。色は呼ぶ側が決める（塗りつぶしの記号は fill、線の記号は stroke） */
function glyphElements(glyph: PinGlyph, ink: string, label: string): PinElement[] {
  const stroke = (d: string, width = 1.2): PinElement => ({
    tag: "path",
    attrs: { d, stroke: ink, "stroke-width": width, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" },
  });
  switch (glyph) {
    case "food": // フォークとナイフ
      return [stroke("M13 7.5v4.2a1.2 1.2 0 0 0 2.4 0V7.5M14.2 7.5v10M19.4 7.5c-1 0-1.8 1.3-1.8 2.9s.8 2.5 1.8 2.5v4.6")];
    case "sight": // カメラ
      return [
        {
          tag: "path",
          attrs: {
            d: "M10.4 10h2l1-1.5h5.2l1 1.5h2a.9.9 0 0 1 .9.9v5a.9.9 0 0 1-.9.9H10.4a.9.9 0 0 1-.9-.9v-5a.9.9 0 0 1 .9-.9z",
            fill: "none",
            stroke: ink,
            "stroke-width": 1.2,
            "stroke-linejoin": "round",
          },
        },
        { tag: "circle", attrs: { cx: 16, cy: 13.4, r: 2, fill: "none", stroke: ink, "stroke-width": 1.2 } },
      ];
    case "nature": // 山
      return [{ tag: "path", attrs: { d: "M9.2 17l4.3-6.8 2.7 4.1 1.9-2.6 4.7 5.3z", fill: ink } }];
    case "activity": // 旗
      return [stroke("M12.2 7.6v10M12.2 8.4h8l-1.8 2.5 1.8 2.5h-8", 1.25)];
    case "event": // チケット
      return [
        {
          tag: "path",
          attrs: {
            d: "M9.8 10.4h12.4v2a1.3 1.3 0 0 0 0 2.5v2H9.8v-2a1.3 1.3 0 0 0 0-2.5z",
            fill: "none",
            stroke: ink,
            "stroke-width": 1.2,
            "stroke-linejoin": "round",
          },
        },
        stroke("M16 11.5v1.2M16 14.4v1.2"),
      ];
    case "shopping": // 買い物袋
      return [
        { tag: "path", attrs: { d: "M10.8 10.8h10.4l-.9 6.8H11.7z", fill: "none", stroke: ink, "stroke-width": 1.2, "stroke-linejoin": "round" } },
        stroke("M13.5 10.8a2.5 2.5 0 0 1 5 0"),
      ];
    case "stay": // ベッド
      return [
        stroke("M9.6 8.6v8.8M9.6 12.6h12.8v4.8M22.4 17.4v-4.8", 1.25),
        { tag: "circle", attrs: { cx: 12.9, cy: 11, r: 1.4, fill: ink } },
        stroke("M15.4 12.6v-1.1a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1.1", 1.25),
      ];
    case "pencil": // 下書き
      return [{ tag: "path", attrs: { d: "M13 16.5l1-2.8 5-5 1.8 1.8-5 5z", fill: ink } }];
    case "dot": // カテゴリ無し
      return [{ tag: "circle", attrs: { cx: 16, cy: 12.5, r: 3.4, fill: ink } }];
    case "number": // しおりの訪問順
      return [
        {
          tag: "text",
          attrs: { x: 16, y: 16.6, "text-anchor": "middle", "font-size": 11, "font-weight": 700, "font-family": "Arial, sans-serif", fill: ink },
          text: label,
        },
      ];
    case "count": // クラスタの件数
      return [
        {
          tag: "text",
          attrs: { x: 16, y: 20.5, "text-anchor": "middle", "font-size": 12, "font-weight": 700, "font-family": "Arial, sans-serif", fill: ink },
          text: label,
        },
      ];
  }
}

/**
 * ピン 1 つ分の要素を並べて返す。
 * `fill` はピンの色、`ink` は記号の色（普通は白。破線の下書きだけピンの色と同じ）。
 */
export function buildPinElements(look: PinLook, colors: { fill: string; white: string }): PinElement[] {
  const elements: PinElement[] = [];

  if (look.halo) {
    // 外側の淡い輪（フォーカス）。同じしずくを少し大きく、薄く敷く
    elements.push({
      tag: "path",
      attrs: { d: TEARDROP_PATH, fill: colors.fill, opacity: 0.25, transform: "translate(16 16.3) scale(1.24) translate(-16 -16.3)" },
    });
  }

  if (look.shape === "circle") {
    elements.push({ tag: "circle", attrs: { cx: 16, cy: 16, r: 14, fill: colors.fill } });
  } else if (look.dashed) {
    elements.push({
      tag: "path",
      attrs: { d: TEARDROP_PATH, fill: colors.white, stroke: colors.fill, "stroke-width": 2, "stroke-dasharray": "3.4 2.6" },
    });
  } else {
    elements.push({ tag: "path", attrs: { d: TEARDROP_PATH, fill: colors.fill } });
  }

  return elements;
}

/** 右肩のバッジ（状態）。バッジは 1 つだけ */
export function buildBadgeElements(look: PinLook, colors: { saved: string; done: string; white: string }): PinElement[] {
  if (look.badge === "heart") {
    return [
      { tag: "circle", attrs: { cx: 24.8, cy: 7.2, r: 6.2, fill: colors.white } },
      {
        tag: "path",
        attrs: { d: "M24.8 10.3c-2.1-1.4-3.6-2.8-3.6-4.4a2 2 0 0 1 3.6-1.2 2 2 0 0 1 3.6 1.2c0 1.6-1.5 3-3.6 4.4z", fill: colors.saved },
      },
    ];
  }
  if (look.badge === "check") {
    return [
      { tag: "circle", attrs: { cx: 24.8, cy: 7.2, r: 6.2, fill: colors.white } },
      {
        tag: "path",
        attrs: {
          d: "M22.1 7.3l1.9 1.9 3.5-3.8",
          stroke: colors.done,
          "stroke-width": 1.9,
          fill: "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
      },
    ];
  }
  return [];
}

/** 記号（カテゴリの絵・番号・件数） */
export function buildGlyphElements(look: PinLook, colors: { fill: string; white: string }, label?: string | number): PinElement[] {
  // 下書きは白抜きではなく、破線と同じ色で描く（中が白いため）
  const ink = look.dashed ? colors.fill : colors.white;
  return glyphElements(look.glyph, ink, String(label ?? ""));
}
