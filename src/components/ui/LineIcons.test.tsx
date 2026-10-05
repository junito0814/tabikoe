import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CommentIcon, HeartIcon, PencilIcon, WarningIcon } from "./LineIcons";

/**
 * 出典: #713（絵文字を減らす）単体テスト
 * 要件定義書 4.5.14・ワイヤーフレーム決定事項 81
 */
describe("線で描いた絵", () => {
  it("色は置いた場所から継ぐ（自分で色を決めない）", () => {
    for (const [name, Icon] of [["鉛筆", PencilIcon], ["吹き出し", CommentIcon], ["ハート", HeartIcon], ["注意", WarningIcon]] as const) {
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("fill"), name).toBe("none");
      // currentColor ＝ 置いた場所の文字色をそのまま使う
      expect(svg.innerHTML, name).toContain("currentColor");
      unmount();
    }
  });

  it("読み上げの邪魔をしない（意味は近くの文字が持つ）", () => {
    const { container } = render(<HeartIcon />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("大きさを揃えられる", () => {
    const { container } = render(<PencilIcon size={13} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "13");
  });
});

/**
 * 【初心者向け】絵文字が戻ってこないかを機械で見張る。
 * 「残す 8 種類」（★ ✓ ← 🏅 🏷 📍 👍 👎）には触らない。
 */
describe("やめた絵文字が画面に戻っていない（#713）", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("🖼 🔖 📅 📷 ✍ 🗺 ✎ 💬 ♥ ⚠ が出ていない", () => {
    const targets: [string, string[]][] = [
      ["src/components/albums/AlbumScreen.tsx", ["🖼", "🔖", "✎"]],
      ["src/components/save/SaveSheet.tsx", ["🔖"]],
      ["src/components/itineraries/ItineraryDetailScreen.tsx", ["📷", "📅", "🗺", "✎"]],
      ["src/components/itineraries/ItineraryListScreen.tsx", ["📷", "♥"]],
      ["src/components/posts/PostDetailScreen.tsx", ["✍"]],
      ["src/components/posts/PostCard.tsx", ["💬"]],
      ["src/components/mypage/MyPostsList.tsx", ["♥"]],
      ["src/components/mypage/DraftsSection.tsx", ["✎"]],
      ["src/components/notices/UploadNotice.tsx", ["⚠"]],
    ];
    for (const [path, emojis] of targets) {
      const source = read(path);
      for (const emoji of emojis) {
        expect(source, `${path} に ${emoji} が残っている`).not.toContain(emoji);
      }
    }
  });

  it("残す 8 種類は触っていない", () => {
    // ★（評価）
    expect(read("src/components/posts/PostCard.tsx")).toContain('"★"');
    // 🏅（バッジ）・🏷 📍（行き先の候補）・👍 👎（スポットの状態）
    expect(read("src/components/badges/BadgeScreen.tsx")).toContain("🏅");
    expect(read("src/components/mypage/MyPageScreen.tsx")).toContain("🏅");
    expect(read("src/components/search/DestinationInput.tsx")).toContain("🏷");
    expect(read("src/components/spots/SpotStatusButtons.tsx")).toContain("👍");
  });
});
