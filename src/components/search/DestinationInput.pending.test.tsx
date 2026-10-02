import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DestinationInput } from "./DestinationInput";
import type { DestinationSuggestion } from "@/lib/search/suggest-destinations";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-9）
 * 要件定義書 4.5.11 の場面 3・8 章 89
 *
 * 【初心者向け】ここは待ち表示だけでなく**実害も直している**。打ち替えても前の言葉の候補が
 * 残っていたので、その状態で Enter を押すと `suggestions[0]`（前の言葉の先頭）が使われ、
 * **打ち替えた先とは違う場所へ飛んでいた**。
 */
const suggestion = (name: string): DestinationSuggestion => ({ kind: "prefecture", name, lat: 34.7, lng: 135.5 });

const ready = (names: string[]) => async () => ({ suggestions: names.map(suggestion), placesUnavailable: false });

describe("4-9: 行き先の入力欄", () => {
  it("探している間は「探しています…」を出す", async () => {
    render(<DestinationInput suggest={() => new Promise(() => {})} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "大阪" } });
    expect(await screen.findByText("探しています…")).toBeInTheDocument();
  });

  it("探し終えたら待ち表示を消し、候補を出す", async () => {
    render(<DestinationInput suggest={ready(["大阪府"])} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "大阪" } });
    expect(await screen.findByRole("option", { name: /大阪府/ })).toBeInTheDocument();
    expect(screen.queryByText("探しています…")).toBeNull();
  });

  it("入力を変えたら前の言葉の候補を残さない", async () => {
    const suggest = vi.fn(async (query: string) => ({
      suggestions: query === "大阪" ? [suggestion("大阪府")] : [],
      placesUnavailable: false,
    }));
    render(<DestinationInput suggest={suggest} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "大阪" } });
    expect(await screen.findByRole("option", { name: /大阪府/ })).toBeInTheDocument();

    // 打ち替えた瞬間に、前の言葉の候補は消える
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "京都" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: /大阪府/ })).toBeNull());
  });

  it("前の言葉の候補で Enter を決定しない（違う場所へ飛ばない）", async () => {
    const onSelect = vi.fn();
    const onSubmitFreeText = vi.fn();
    const suggest = vi.fn(async (query: string) => ({
      suggestions: query === "大阪" ? [suggestion("大阪府")] : [],
      placesUnavailable: false,
    }));
    render(<DestinationInput suggest={suggest} onSelect={onSelect} onSubmitFreeText={onSubmitFreeText} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "大阪" } });
    await screen.findByRole("option", { name: /大阪府/ });

    // 「京都」に打ち替えた直後（まだ候補が届いていない）に Enter
    fireEvent.change(input, { target: { value: "京都" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(onSelect).not.toHaveBeenCalled();
    // 候補が無いので自由入力として扱われる。渡るのは打ち替えた後の言葉
    expect(onSubmitFreeText).toHaveBeenCalledWith("京都");
  });
});

/*
 * #665（2026-10-03）: 「どこへ行く？」で候補が出たり消えたりする
 *
 * 【初心者向け】原因は 2 つあった。
 *   1. 日本語の**変換中**にも候補を取りに行き、確定して文字が変わった瞬間に候補が消える
 *   2. **古い応答が新しい応答を上書きする**（候補が消えたまま戻らない）
 */
describe("#665: 候補が出たり消えたりする", () => {
  /** jsdom は日本語変換を持たないので、変換の開始・確定を自分で起こす */
  const compose = (input: HTMLElement, steps: string[], committed: string) => {
    fireEvent.compositionStart(input);
    for (const step of steps) fireEvent.change(input, { target: { value: step } });
    fireEvent.change(input, { target: { value: committed } });
    fireEvent.compositionEnd(input, { target: { value: committed } });
  };

  it("変換中は候補を取りに行かない（確定した言葉で 1 回だけ）", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const suggest = vi.fn(async (query: string) => ({ suggestions: [suggestion("東京都")], placesUnavailable: false, query }));
      render(<DestinationInput suggest={suggest} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
      const input = screen.getByRole("combobox");

      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: "とうきょう" } });
      // 変換を考えている間に 300ms 以上止まっても、取りに行かない
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(suggest).not.toHaveBeenCalled();
      expect(screen.queryByText("探しています…"), "変換中は待ち表示も出さない").toBeNull();
      // ここで候補が出てしまうと、確定した瞬間に消える（これが報告された現象そのもの）
      expect(screen.queryByRole("listbox"), "変換中に候補を出さない").toBeNull();

      // 確定
      fireEvent.change(input, { target: { value: "東京" } });
      fireEvent.compositionEnd(input, { target: { value: "東京" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(suggest).toHaveBeenCalledTimes(1);
      expect(suggest.mock.calls[0][0]).toBe("東京");
    } finally {
      vi.useRealTimers();
    }
  });

  // 念のための番人（これ自体は直す前のコードでも通る。消える瞬間を捉えているのは上のテスト）
  it("変換して確定したあと、候補が出たまま消えない", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<DestinationInput suggest={ready(["東京都"])} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
      const input = screen.getByRole("combobox");
      compose(input, ["と", "とう", "とうきょう"], "東京");
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(screen.getByRole("option", { name: /東京都/ })).toBeInTheDocument();
      // そのあと時間が経っても消えない
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.getByRole("option", { name: /東京都/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("古い応答が遅れて届いても、新しい候補を消さない", async () => {
    const resolvers: Record<string, (value: { suggestions: DestinationSuggestion[]; placesUnavailable: boolean }) => void> = {};
    const suggest = vi.fn(
      (query: string) => new Promise<{ suggestions: DestinationSuggestion[]; placesUnavailable: boolean }>((resolve) => { resolvers[query] = resolve; })
    );
    render(<DestinationInput suggest={suggest} onSelect={vi.fn()} onSubmitFreeText={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "とうきょう" } });
    await waitFor(() => expect(resolvers["とうきょう"]).toBeTypeOf("function"));
    fireEvent.change(input, { target: { value: "東京" } });
    await waitFor(() => expect(resolvers["東京"]).toBeTypeOf("function"));

    // 新しい方が先に返る
    await act(async () => { resolvers["東京"]({ suggestions: [suggestion("東京都")], placesUnavailable: false }); });
    expect(await screen.findByRole("option", { name: /東京都/ })).toBeInTheDocument();

    // 遅れて古い方が返っても、候補はそのまま
    await act(async () => { resolvers["とうきょう"]({ suggestions: [suggestion("とうきょう の候補")], placesUnavailable: false }); });
    expect(screen.getByRole("option", { name: /東京都/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /とうきょう/ })).toBeNull();
    expect(screen.queryByText("探しています…"), "待ち表示が残らない").toBeNull();
  });
});
