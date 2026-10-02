import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { TripTitleInput, type TripSuggestion } from "./TripTitleInput";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-9）
 * 要件定義書 4.5.11 の場面 3・8 章 89
 */
const suggestion = (id: string, title: string): TripSuggestion => ({ id, title, source: "own" });

/** 親が値を持つ「制御コンポーネント」なので、入れ物で value を持つ */
function Harness({ fetchSuggestions }: { fetchSuggestions: (query: string) => Promise<TripSuggestion[]> }) {
  const [value, setValue] = useState("");
  return <TripTitleInput value={value} onChange={setValue} fetchSuggestions={fetchSuggestions} />;
}

describe("4-9: アルバム名の入力欄", () => {
  it("探している間は「探しています…」を出す", async () => {
    render(<Harness fetchSuggestions={() => new Promise(() => {})} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "沖縄" } });
    expect(await screen.findByText("探しています…")).toBeInTheDocument();
  });

  it("探し終えたら待ち表示を消し、候補を出す", async () => {
    render(<Harness fetchSuggestions={async () => [suggestion("t1", "沖縄旅行")]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "沖縄" } });
    expect(await screen.findByRole("option", { name: /沖縄旅行/ })).toBeInTheDocument();
    expect(screen.queryByText("探しています…")).toBeNull();
  });

  it("入力を変えたら前の言葉の候補を残さない", async () => {
    const fetchSuggestions = vi.fn(async (query: string) => (query === "沖縄" ? [suggestion("t1", "沖縄旅行")] : []));
    render(<Harness fetchSuggestions={fetchSuggestions} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "沖縄" } });
    expect(await screen.findByRole("option", { name: /沖縄旅行/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "北海道" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: /沖縄旅行/ })).toBeNull());
  });

  it("入力欄を閉じているときは待ち表示を出さない（関係ない文字をちらつかせない）", async () => {
    render(<Harness fetchSuggestions={() => new Promise(() => {})} />);
    // まだ一度も触っていない（isOpen が false）
    expect(screen.queryByText("探しています…")).toBeNull();
  });
});
