import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { SpotAutocompleteInput, type SpotCandidate } from "./SpotAutocompleteInput";
import type { RegisteredSpot } from "@/lib/spots/types";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";

/**
 * 出典: docs/tasks/posts/spot-selection/03-spot-autocomplete-ui.md 単体テスト
 *       docs/tasks/shared-ui/error-display/02-service-specific-error-integration.md 単体テスト
 *       （スポット検索API障害時：規定メッセージ表示＋SC-19導線の維持）
 *
 * SC-19モーダル自体はGoogle Mapsを要するため、ここでは開く導線までを検証する。
 */
vi.mock("./ManualSpotRegistrationModal", () => ({
  ManualSpotRegistrationModal: () => <div data-testid="sc19-modal">SC-19</div>,
}));

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

  it("候補が無い場合はSC-19への導線を表示する", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "存在しない場所" } });

    expect(await screen.findByText(/候補が見つかりません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地図でスポットを登録する" })).toBeInTheDocument();
  });

  it("導線を押すとSC-19モーダルが開く", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: "地図でスポットを登録する" }));

    expect(screen.getByTestId("sc19-modal")).toBeInTheDocument();
  });

  it("Places API障害時は規定メッセージを出しつつ、手動登録の導線は維持する（要件6.2）", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: true })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "x" } });

    expect(await screen.findByText(ERROR_MESSAGES.placeSearchFailure)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "地図でスポットを登録する" })).toBeInTheDocument();
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
