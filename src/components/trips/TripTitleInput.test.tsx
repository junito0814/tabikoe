import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { TripTitleInput, type TripSuggestion } from "./TripTitleInput";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";

/**
 * 出典: docs/tasks/posts/trip-title/04-trip-title-input-ui.md 単体テスト
 * - 入力に応じて候補一覧（モック）が表示されること
 * - 候補選択時に選択値が入力欄へ反映されること
 * - 200文字を超える入力に対して警告表示されること
 */
const SAMPLE: TripSuggestion[] = [
  { id: "1", title: "沖縄 2泊3日" },
  { id: "2", title: "京都ひとり旅" },
];

/** 制御コンポーネントなので、状態を持つ薄いラッパーで包んでテストする */
function Harness({
  fetchSuggestions,
  initialValue = "",
}: {
  fetchSuggestions: (query: string) => Promise<TripSuggestion[]>;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <TripTitleInput value={value} onChange={setValue} fetchSuggestions={fetchSuggestions} />
  );
}

describe("TripTitleInput", () => {
  it("入力に応じて候補一覧が表示される", async () => {
    const fetchSuggestions = vi.fn(async (query: string) =>
      SAMPLE.filter((trip) => trip.title.includes(query))
    );
    render(<Harness fetchSuggestions={fetchSuggestions} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "沖縄" } });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "沖縄 2泊3日" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: "京都ひとり旅" })).not.toBeInTheDocument();
    expect(fetchSuggestions).toHaveBeenCalledWith("沖縄");
  });

  it("候補を選択すると入力欄に反映され、一覧は閉じる", async () => {
    render(<Harness fetchSuggestions={async () => SAMPLE} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "旅" } });
    const option = await screen.findByRole("option", { name: "京都ひとり旅" });
    fireEvent.click(option.querySelector("button")!);

    expect(screen.getByRole("combobox")).toHaveValue("京都ひとり旅");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("200文字以内では警告を出さない", () => {
    render(<Harness fetchSuggestions={async () => []} initialValue={"あ".repeat(200)} />);
    expect(screen.getByText(`200 / ${MAX_TRIP_TITLE_LENGTH}`)).toBeInTheDocument();
    expect(screen.queryByText(/文字以内で入力してください/)).not.toBeInTheDocument();
  });

  it("200文字を超えると警告を表示する", () => {
    render(<Harness fetchSuggestions={async () => []} initialValue={"あ".repeat(201)} />);
    expect(screen.getByText(`201 / ${MAX_TRIP_TITLE_LENGTH}`)).toBeInTheDocument();
    expect(screen.getByText(`${MAX_TRIP_TITLE_LENGTH}文字以内で入力してください`)).toBeInTheDocument();
  });

  it("文字数は書記素クラスタ単位で数える", () => {
    render(<Harness fetchSuggestions={async () => []} initialValue={"😀".repeat(3)} />);
    expect(screen.getByText(`3 / ${MAX_TRIP_TITLE_LENGTH}`)).toBeInTheDocument();
  });

  it("候補取得が失敗しても入力欄は使える", async () => {
    render(<Harness fetchSuggestions={async () => { throw new Error("network"); }} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "x" } });
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("x");
    });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
