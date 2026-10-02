import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ContentEnter, PhotoMorph, SkeletonExit } from "./Reveal";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/08-view-transitions.md 単体テスト
 * 要件定義書 4.5.11 の場面 5・8 章 95
 *
 * 【初心者向け】`ViewTransition` は **Next.js が同梱している React にだけある**。
 * 単体テスト（vitest）が読む `node_modules/react`（安定版）には無いので、
 * ここでは「動きそのもの」ではなく次の 2 つを確かめる。
 *   1. 無い環境でも**中身がそのまま描かれる**（落ちない・消えない）
 *   2. 包みに付ける名前と、globals.css の動きの名前が**食い違っていない**
 * 動きが実際に出るかは実機で確かめる（同梱ドキュメントに「Safari では挙動が違うことがある」）。
 */
const reveal = readFileSync("src/components/transitions/Reveal.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("包みは中身を消さない（ViewTransition が無い環境でも）", () => {
  it("SkeletonExit は中身をそのまま描く", () => {
    render(
      <SkeletonExit>
        <p>骨組み</p>
      </SkeletonExit>
    );
    expect(screen.getByText("骨組み")).toBeInTheDocument();
  });

  it("ContentEnter は中身をそのまま描く", () => {
    render(
      <ContentEnter>
        <p>本物</p>
      </ContentEnter>
    );
    expect(screen.getByText("本物")).toBeInTheDocument();
  });

  it("PhotoMorph は中身をそのまま描く", () => {
    render(
      <PhotoMorph postId="p-1">
        <p>写真</p>
      </PhotoMorph>
    );
    expect(screen.getByText("写真")).toBeInTheDocument();
  });
});

describe("名前が CSS と食い違っていない", () => {
  it.each([
    ["skeleton-out", "::view-transition-old(.skeleton-out)"],
    ["content-in", "::view-transition-new(.content-in)"],
    ["morph", "::view-transition-group(.morph)"],
  ])("%s の動きが globals.css にある", (name, selector) => {
    expect(reveal).toContain(`"${name}"`);
    expect(css).toContain(selector);
  });

  it("時間はタスク文書のとおり（退く 150ms・現れる 210ms・移動 400ms）", () => {
    expect(css).toContain("--vt-exit: 150ms");
    expect(css).toContain("--vt-enter: 210ms");
    expect(css).toContain("--vt-move: 400ms");
  });

  it("現れる側は退き終わってから始まる（遅らせている）", () => {
    // 先に消して、あとからゆっくり出す。古いものが注意を引かないようにするため
    expect(css).toMatch(/::view-transition-new\(\.content-in\)[\s\S]*?var\(--vt-enter\) ease-in var\(--vt-exit\)/);
  });
});

describe("どの包みにも default=\"none\" が付いている", () => {
  it("関係のない切り替わりで毎回動かないようにする", () => {
    // 同梱ドキュメントの注意書き。これが無いと名前付きの包みが毎回動く。
    // コメント中の文字も拾わないよう、`<ViewTransition` の行だけを見る
    const tags = reveal.match(/^\s*<ViewTransition .*$/gm) ?? [];
    expect(tags).toHaveLength(3);
    for (const tag of tags) {
      expect(tag, tag).toContain('default="none"');
    }
  });
});

describe("動きを減らす設定・押せることへの配慮", () => {
  it("prefers-reduced-motion のときは動かさない", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?::view-transition-old\(\*\)/);
  });

  it("動いている間も下の画面を押せる", () => {
    expect(css).toMatch(/::view-transition \{[\s\S]*?pointer-events: none/);
  });
});

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/08-view-transitions.md 単体テスト（8-2）
 *
 * 【初心者向け】同じ名前の包みが 1 つの画面に 2 つあると、**どちらを繋ぐか決まらない**。
 * そこで「名前を付けるかどうか」を `morphPostId` という引数で呼び出し側に選ばせている。
 * 渡してよいのは投稿カードと投稿詳細だけ。ここではその約束が守られているかを見る。
 */
describe("8-2: 同じ名前が 1 画面に 2 つ出ない", () => {
  const mediaGrid = readFileSync("src/components/media/MediaGrid.tsx", "utf8");

  it("名前を付けるのは代表写真（1 枚目）だけ", () => {
    expect(mediaGrid).toMatch(/index === 0 && morphPostId/);
  });

  it("MediaGrid が自分で名前を決めていない（呼び出し側が選ぶ）", () => {
    // 中で post.id を拾って勝手に名前を付けると、同じ投稿が重なる場所で名前が衝突する
    expect(mediaGrid).not.toMatch(/PhotoMorph postId=\{items/);
  });

  it("渡しているのは投稿カードと投稿詳細の 2 か所だけ", () => {
    const callers = [
      "src/components/posts/PostCard.tsx",
      "src/components/posts/PostDetailScreen.tsx",
      "src/components/albums/AlbumScreen.tsx",
      "src/components/media/PhotoGrid.tsx",
    ];
    const passes = callers.filter((path) => readFileSync(path, "utf8").includes("morphPostId="));
    expect(passes).toEqual(["src/components/posts/PostCard.tsx", "src/components/posts/PostDetailScreen.tsx"]);
  });

  it("写真タブ（PhotoGrid）は MediaGrid を通さないので名前が付かない", () => {
    // 同じ投稿の写真が何枚も並ぶ場所。MediaThumbnail を直に使っている
    const photoGrid = readFileSync("src/components/media/PhotoGrid.tsx", "utf8");
    expect(photoGrid).toContain("<MediaThumbnail");
    expect(photoGrid).not.toContain("<MediaGrid");
    expect(photoGrid).not.toContain("PhotoMorph");
  });
});
