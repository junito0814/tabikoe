import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { SpotAutocompleteInput, type SpotCandidate } from "./SpotAutocompleteInput";
import type { RegisteredSpot } from "@/lib/spots/types";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";

/**
 * 出典: docs/tasks/posts/spot-selection/03-spot-autocomplete-ui.md 単体テスト
 *       docs/tasks/shared-ui/error-display/02-service-specific-error-integration.md 単体テスト
 *       （スポット検索API障害時：規定メッセージを出しつつ候補の表示は続ける）
 *
 * #527: 手動登録モーダル（SC-19）は廃止済み。候補が無いときは「地図でピンを合わせて『新しい場所』として
 * 投稿できます」と案内するだけで、この部品からは何も開かない（登録は SC-03 の上 1/3 の地図が兼ねる）。
 */

const REGISTERED: SpotCandidate = {
  id: "spot-1",
  name: "首里城",
  lat: 26.217,
  lng: 127.719,
  source: "manual",
  postCount: 12,
};

function Harness({
  searchSpots,
}: {
  searchSpots: (query: string) => Promise<{ candidates: SpotCandidate[]; placesUnavailable: boolean }>;
}) {
  const [spot, setSpot] = useState<RegisteredSpot | null>(null);
  return <SpotAutocompleteInput selectedSpot={spot} onSelect={setSpot} searchSpots={searchSpots} />;
}

describe("SpotAutocompleteInput", () => {
  it("入力に応じて候補が表示される", async () => {
    render(
      <Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: false })} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });
    expect(await screen.findByRole("option", { name: "首里城" })).toBeInTheDocument();
  });

  it("登録済み候補を選ぶと選択状態になり、IDが投稿に渡る", async () => {
    render(
      <Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: false })} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });
    const option = await screen.findByRole("option", { name: "首里城" });
    fireEvent.click(option.querySelector("button")!);

    // 選択後は入力欄ではなく確定表示になる
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("首里城")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "変更" })).toBeInTheDocument();
  });

  it("「変更」で選択を解除して再入力できる", async () => {
    render(
      <Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: false })} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });
    fireEvent.click((await screen.findByRole("option", { name: "首里城" })).querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "変更" }));

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  // #527: 手動登録モーダル（SC-19）は廃止。候補が無いときは案内文だけを出し、開くものは無い
  it("候補が無い場合は「地図でピンを合わせて」の案内だけを出す", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "存在しない場所" } });

    expect(await screen.findByText(/候補が見つかりません。地図でピンを合わせて/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "地図でスポットを登録する" })).not.toBeInTheDocument();
  });

  it("Places API障害時は規定メッセージを出す（要件6.2）", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: true })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "x" } });

    expect(await screen.findByText(ERROR_MESSAGES.placeSearchFailure)).toBeInTheDocument();
  });

  it("Places API障害時でも登録済みスポットの候補は表示される", async () => {
    render(
      <Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: true })} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });

    expect(await screen.findByRole("option", { name: "首里城" })).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.placeSearchFailure)).toBeInTheDocument();
  });

  it("入力を空に戻すと候補と導線が消える", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: false })} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "首里" } });
    await screen.findByRole("option", { name: "首里城" });

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/候補が見つかりません/)).not.toBeInTheDocument();
  });
});

/**
 * #699（2026-10-05）: Google の規約が「Places のデータを地図の無い画面に出すときは
 * 「Google マップ」の表記を出す」「どれが Google 由来か分かるようにする」と求めている。
 */
describe("Google の表記（#699）", () => {
  const FROM_GOOGLE: SpotCandidate = {
    id: null,
    name: "首里金城町石畳道",
    lat: 26.213,
    lng: 127.714,
    source: "places",
    postCount: 0,
  };

  it("出どころで分け、Google の組の下に公式のロゴを出す", async () => {
    render(
      <Harness
        searchSpots={async () => ({ candidates: [FROM_GOOGLE, REGISTERED], placesUnavailable: false })}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });
    await screen.findByRole("option", { name: "首里城" });

    const groups = screen.getAllByRole("listbox");
    expect(groups).toHaveLength(2);
    // タビコエが先、Google が後
    expect(groups[0]).toHaveAttribute("aria-label", "タビコエの中から");
    expect(groups[1]).toHaveAttribute("aria-label", "Google マップから");
    expect(document.querySelector("[data-google-maps-attribution]")).toBeInTheDocument();
  });

  it("登録済みだけのときは Google の見出しもロゴも出さない", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [REGISTERED], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "首里" } });
    await screen.findByRole("option", { name: "首里城" });

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(screen.queryByText("Google マップから")).not.toBeInTheDocument();
    expect(document.querySelector("[data-google-maps-attribution]")).not.toBeInTheDocument();
  });
});
