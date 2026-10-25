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
 *   3. #1029 で消した受け渡しの動きが**戻ってきていない**
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
  it("morph の動きが globals.css にある", () => {
    expect(reveal).toContain('"morph"');
    expect(css).toContain("::view-transition-group(.morph)");
  });

  it("移動の時間はタスク文書のとおり（400ms）", () => {
    expect(css).toContain("--vt-move: 400ms");
  });
});

/**
 * #1029（2026-10-25）: 骨組み → 本物の受け渡しの動きをやめた。
 * 出典: 要件定義書 4.5.11「場面 5 の決着」
 *
 * 【初心者向け】iPhone では、本物が下からではなく**右下から斜めに**出ていた。
 * 横は 7px のまま動かず最後に一瞬で戻る（＝動きではなく置かれる位置がずれている）。
 * 指示しているのは縦 10px だけで、Chrome とデスクトップの WebKit では指示どおりに動く。
 * iOS 側の置き方なので直せない。**消したものが戻ってこないこと**をここで止める。
 */
describe("#1029: 受け渡しの動きは消えている", () => {
  /*
   * 【初心者向け】コメントを取り除いてから見ます。globals.css には
   * 「やめたもの」を取り消し線つきで**コメントとして残している**ので、
   * そのまま探すと文字だけが見つかってしまいます（約束 16）。
   */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it.each(["skeleton-out", "content-in", "vt-slide-y", "vt-fade", "--vt-exit", "--vt-enter"])(
    "globals.css の規則に %s が無い",
    (gone) => {
      expect(rules).not.toContain(gone);
    }
  );

  it("包みは ViewTransition を使っていない", () => {
    expect(reveal).not.toContain('exit="skeleton-out"');
    expect(reveal).not.toContain('enter="content-in"');
  });

  it("写真が繋がって育つ動きだけが残っている", () => {
    // 同梱ドキュメントの注意書き。`default="none"` が無いと関係のない切り替わりでも動く。
    // コメント中の文字も拾わないよう、`<ViewTransition` の行だけを見る
    const tags = reveal.match(/^\s*<ViewTransition .*$/gm) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('share="morph"');
    expect(tags[0]).toContain('default="none"');
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

/**
 * #1032（2026-10-25）: 本物が下から上がる動きを、ビュートランジションを使わずに戻した。
 * 出典: 要件定義書 4.5.11「場面 5 の決着・その 2」・8 章 95
 *
 * 【初心者向け】ここでいちばん大事なのは **`transform` と `filter` が入っていないこと**。
 * どちらも**中の `position: fixed` の基準になる**ので、包みの中にある投稿ボタン
 * （`fixed bottom-[76px] right-4`）と未ログインの帯（`fixed inset-x-0 bottom-0`）が、
 * 動いているあいだ画面の外へ下がってしまう。**#1029 で消した症状の作り直し**になる。
 * あとから「`translateY` のほうが速いのでは」と書き換えられないよう、ここで止める。
 */
describe("#1032: 本物が下から上がる", () => {
  /** `.content-enter { ... }` と、そこから呼ばれるキーフレームの中身だけを取り出す */
  const block = (name: string) => {
    const m = css.match(new RegExp(`${name.replace(".", "\\.")}\\s*\\{[\\s\\S]*?\\n\\}`));
    return m?.[0] ?? "";
  };
  const enter = block(".content-enter");
  const rise = block("@keyframes content-rise");
  const fade = block("@keyframes content-fade");

  it("包みが `.content-enter` を付けて描かれる", () => {
    expect(reveal).toContain('className="content-enter"');
    expect(enter).not.toBe("");
  });

  it("動かしているのは top（transform ではない）", () => {
    expect(enter).toContain("position: relative");
    expect(rise).toContain("top: var(--enter-distance)");
    expect(rise).toContain("top: 0");
  });

  /*
   * #1036（2026-10-25）: 実寸の枠で見比べて決めた値（要件 4.5.11「場面 5 の決着・その 2」）。
   *
   * 【初心者向け】上がる時間に `--vt-move` を使い回すと、**写真が繋がって育つ動き**
   * （`.morph`）まで一緒に変わってしまいます。別の変数に分けてあることも、ここで止めます。
   */
  it("値はドキュメントのとおり（12px・160ms・ease-out、薄さも 160ms）", () => {
    // 12px なのは速さの都合。30fps でしか描けないので、段差を 2〜3px に抑える
    expect(css).toContain("--enter-distance: 12px");
    expect(css).toContain("--enter-rise: 160ms");
    // 薄さは動きと同じ長さ。短いほうが先に終わると、止まったあとも色だけ変わり続ける
    expect(css).toContain("--enter-fade: 160ms");
    expect(enter).toContain("var(--enter-fade) ease-out");
    expect(enter).toContain("var(--enter-rise) ease-out");
  });

  it("写真が繋がって育つ動きの時間（--vt-move）を使い回していない", () => {
    expect(enter).not.toContain("--vt-move");
    expect(css).toContain("--vt-move: 400ms");
  });

  it.each(["transform", "filter", "translate", "scale", "rotate", "will-change", "perspective"])(
    "%s を使っていない（position: fixed の基準を作らないため）",
    (forbidden) => {
      for (const part of [enter, rise, fade]) {
        expect(part).not.toContain(forbidden);
      }
    }
  );

  it("薄さだけで出す（ぼかしは入れない）", () => {
    expect(fade).toContain("opacity: 0");
    expect(fade).toContain("opacity: 1");
  });

  it("動きを減らす設定のときは上がる動きを止める", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.content-enter/);
  });
});
