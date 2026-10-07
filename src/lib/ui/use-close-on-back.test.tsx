import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { __resetOverlayStackForTest, useCloseOnBack } from "./use-close-on-back";

/**
 * 出典: Issue #796「Bug 4: Android の戻るキーでシートが閉じず、画面ごと戻る」
 *
 * 【初心者向け】jsdom には本物の履歴が無いので、`history.pushState` と `history.back` が
 * 何回呼ばれたかを覗き、戻るキーの代わりに `popstate` を自分で起こして確かめる。
 */
function Sample({ open, onClose }: { open: boolean; onClose: () => void }) {
  useCloseOnBack(open, onClose);
  return <div />;
}

let pushState: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});
  back = vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => {
  pushState.mockRestore();
  back.mockRestore();
});

const pressBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

describe("useCloseOnBack（#796）", () => {
  beforeEach(() => __resetOverlayStackForTest());

  it("閉じている間は履歴を積まない", () => {
    render(<Sample open={false} onClose={vi.fn()} />);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("開くと履歴を 1 つ積む（URL は変えない）", () => {
    render(<Sample open onClose={vi.fn()} />);
    expect(pushState).toHaveBeenCalledTimes(1);
    // 第 3 引数（URL）を渡していない＝ URL は変わらない
    expect(pushState.mock.calls[0].length).toBe(2);
  });

  it("戻るキーが来たら閉じる", () => {
    const onClose = vi.fn();
    render(<Sample open onClose={onClose} />);
    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("戻るキーで閉じたときは history.back を呼ばない（前の画面まで戻ってしまうため）", () => {
    const { rerender } = render(<Sample open onClose={vi.fn()} />);
    pressBack();
    rerender(<Sample open={false} onClose={vi.fn()} />);
    expect(back).not.toHaveBeenCalled();
  });

  it("× で閉じたときは積んだ分を戻す（履歴が二重に残らない）", () => {
    const { rerender } = render(<Sample open onClose={vi.fn()} />);
    rerender(<Sample open={false} onClose={vi.fn()} />);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("閉じたあとの戻るキーでは何も起きない（見張りを外している）", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sample open onClose={onClose} />);
    rerender(<Sample open={false} onClose={onClose} />);
    onClose.mockClear();
    pressBack();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("開いたまま画面を離れても積んだ分を戻す", () => {
    const { unmount } = render(<Sample open onClose={vi.fn()} />);
    unmount();
    expect(back).toHaveBeenCalledTimes(1);
  });
});

/*
 * #874（2026-10-07）: 重なって開いているとき（コメントのシートの中から削除の確認）。
 *
 * 【初心者向け】手当てが無いと、戻るキー 1 回で**両方**閉じたり、
 * 内側を × で閉じただけで**外側まで**閉じたりします。
 */
describe("重なって開いているとき（#874）", () => {
  beforeEach(() => __resetOverlayStackForTest());

  function Two({ outer, inner, onOuter, onInner }: { outer: boolean; inner: boolean; onOuter: () => void; onInner: () => void }) {
    return (
      <>
        <Sample open={outer} onClose={onOuter} />
        <Sample open={inner} onClose={onInner} />
      </>
    );
  }

  it("戻るキーで閉じるのは、いちばん上の 1 枚だけ", () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    render(<Two outer inner onOuter={onOuter} onInner={onInner} />);
    pressBack();
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();
  });

  it("内側を × で閉じても、外側は閉じない", () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const { rerender } = render(<Two outer inner onOuter={onOuter} onInner={onInner} />);
    // 内側だけ閉じる（後片づけで history.back が走る）
    rerender(<Two outer inner={false} onOuter={onOuter} onInner={onInner} />);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onOuter).not.toHaveBeenCalled();
  });

  it("内側を閉じたあと、戻るキーで外側が閉じる", () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const { rerender } = render(<Two outer inner onOuter={onOuter} onInner={onInner} />);
    rerender(<Two outer inner={false} onOuter={onOuter} onInner={onInner} />);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    pressBack();
    expect(onOuter).toHaveBeenCalledTimes(1);
  });
});
