import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FadeInImage } from "./FadeInImage";

/** 出典: docs/tasks/shared-ui/loading-feedback/07-photo-fade.md 単体テスト */

/** jsdom の <img> は complete を持たないので、テストの間だけ差し替える */
function stubComplete(value: boolean) {
  const original = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => value });
  return () => {
    if (original) Object.defineProperty(HTMLImageElement.prototype, "complete", original);
    else Reflect.deleteProperty(HTMLImageElement.prototype, "complete");
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FadeInImage", () => {
  it("読み込みが終わるまでは透明で、終わったら出る", () => {
    const restore = stubComplete(false);
    render(<FadeInImage src="/a.jpg" alt="たこ焼きの写真" />);
    const img = screen.getByAltText("たこ焼きの写真");
    expect(img).toHaveAttribute("data-fade-in", "hidden");
    expect(img.className).toContain("opacity-0");

    fireEvent.load(img);
    expect(img).toHaveAttribute("data-fade-in", "shown");
    expect(img.className).toContain("opacity-100");
    restore();
  });

  it("既にブラウザが持っている写真は最初から出ている（戻るたびにふわっとさせない）", () => {
    const restore = stubComplete(true);
    render(<FadeInImage src="/a.jpg" alt="たこ焼きの写真" />);
    expect(screen.getByAltText("たこ焼きの写真")).toHaveAttribute("data-fade-in", "shown");
    restore();
  });

  it("読み込みに失敗しても出す（透明のままだと壊れた印も alt も見えなくなる）", () => {
    const restore = stubComplete(false);
    render(<FadeInImage src="/broken.jpg" alt="たこ焼きの写真" />);
    const img = screen.getByAltText("たこ焼きの写真");
    expect(img).toHaveAttribute("data-fade-in", "hidden");
    fireEvent.error(img);
    expect(img).toHaveAttribute("data-fade-in", "shown");
    restore();
  });

  it("動きを減らす設定の人にはすぐ出す", () => {
    const restore = stubComplete(false);
    render(<FadeInImage src="/a.jpg" alt="たこ焼きの写真" />);
    expect(screen.getByAltText("たこ焼きの写真").className).toContain("motion-reduce:transition-none");
    restore();
  });

  it("現れる時間は 210ms（要件 4.5.11 の場面 5 と揃える）。呼び出し側の見た目の指定は残る", () => {
    const restore = stubComplete(false);
    render(<FadeInImage src="/a.jpg" alt="たこ焼きの写真" className="h-full w-full object-cover" />);
    const img = screen.getByAltText("たこ焼きの写真");
    expect(img.className).toContain("duration-[210ms]");
    expect(img.className).toContain("object-cover");
    restore();
  });
});
