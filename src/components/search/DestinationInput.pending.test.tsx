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
