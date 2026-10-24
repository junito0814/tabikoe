import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientOnly } from "./ClientOnly";

/**
 * 出典: #1014「地図を 2 回目に開くとハイドレーションの不一致（React #418）が出る」
 *
 * 【初心者向け】この部品の役目は「**サーバーとブラウザの 1 回目をそろえる**」ことです。
 * サーバーでは骨組みだけを出し、ブラウザで描き終わってから本物に差し替えます。
 * サーバー側の出力に本物が混ざっていないことを見るのが、ここのいちばん大事なテストです。
 */
describe("ClientOnly（#1014）", () => {
  it("サーバーでは骨組みだけを出す（本物は出さない）", () => {
    const html = renderToStaticMarkup(
      <ClientOnly fallback={<p>骨組み</p>}>
        <p>本物</p>
      </ClientOnly>,
    );
    expect(html).toContain("骨組み");
    expect(html).not.toContain("本物");
  });

  it("ブラウザでは本物を出す", () => {
    render(
      <ClientOnly fallback={<p>骨組み</p>}>
        <p>本物</p>
      </ClientOnly>,
    );
    expect(screen.getByText("本物")).toBeInTheDocument();
    expect(screen.queryByText("骨組み")).not.toBeInTheDocument();
  });
});
