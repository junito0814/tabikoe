import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareButton } from "./ShareButton";
import { spotShareContent, type ShareContent } from "@/lib/share/share-text";

/**
 * 出典: Issue #953、要件定義書 4.5.18
 * - 共有シートが使える環境では、シートを開くだけ（**「共有しました」とは出さない**）
 * - 使えない環境（パソコンの Firefox など）では URL をコピーし、「コピーしました」のトースト
 * - 相対 URL は絶対 URL にしてから渡す（共有先では `/spots/s1` は意味を成さない）
 */
const content = spotShareContent({ spotName: "浅草寺", postCount: 2, ratingAverage: 4, url: "/spots/s1" });

describe("ShareButton（#953）", () => {
  it("アイコンだけのボタン（文字は添えない）", () => {
    render(<ShareButton content={content} />);
    const button = screen.getByRole("button", { name: "共有する" });
    expect(button.textContent).toBe("");
    expect(button).toHaveClass("rounded-full");
  });

  it("共有シートが使える環境では、絶対 URL にして渡すだけ（何も出さない）", async () => {
    const share = vi.fn<(content: ShareContent) => Promise<boolean>>(async () => true);
    render(<ShareButton content={content} share={share} />);
    fireEvent.click(screen.getByRole("button", { name: "共有する" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0]).toEqual({
      title: "浅草寺｜タビコエ",
      text: "行った人の投稿 2 件　★4.0",
      url: `${window.location.origin}/spots/s1`,
    });
    // 送れたかは取れないので、「共有しました」とは出さない
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("使えない環境では URL をコピーし、「コピーしました」のトーストを出す", async () => {
    const copy = vi.fn<(text: string) => Promise<boolean>>(async () => true);
    render(<ShareButton content={content} share={async () => false} copy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "共有する" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("コピーしました"));
    expect(copy.mock.calls[0][0]).toBe(`浅草寺｜タビコエ\n行った人の投稿 2 件　★4.0\n${window.location.origin}/spots/s1`);
  });

  it("コピーもできない環境では、できなかったことを言う（黙って終わらない）", async () => {
    render(<ShareButton content={content} share={async () => false} copy={async () => false} />);
    fireEvent.click(screen.getByRole("button", { name: "共有する" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("コピーできませんでした"));
  });
});
