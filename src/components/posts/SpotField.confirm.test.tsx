import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { SpotField, type ConfirmSpotInput } from "./SpotField";
import type { RegisteredSpot } from "@/lib/spots/types";
import type { SpotCandidate } from "@/components/spots/SpotAutocompleteInput";

/**
 * 出典: #700（place_id を保存し、スポットの値を「利用者が確定したもの」にする）単体テスト
 * 要件定義書 6.2「Google から借りるものの方針」・3.3.5
 *
 * 【初心者向け】いちばん大事なのは「**Google が返した座標をそのまま保存しない**」こと。
 * 候補を選んだあと利用者が地図を動かせるので、保存するのは**押した時点の地図の中心**。
 */
const GOOGLE_CANDIDATE: SpotCandidate = {
  id: null,
  name: "伏見稲荷大社",
  lat: 34.9671,
  lng: 135.7727,
  source: "places",
  postCount: 0,
  placeId: "ChIJ-fushimi",
};

const REGISTERED: RegisteredSpot = {
  id: "spot-1",
  name: "伏見稲荷大社",
  lat: 34.9,
  lng: 135.7,
  prefecture: "京都府",
  source: "places",
};

/** 地図の中心を親が持っている形を再現する（本物は PostComposeScreen） */
function Harness({
  registerSpot,
  fetchPrefecture = async () => "京都府",
}: {
  registerSpot: (input: ConfirmSpotInput) => Promise<RegisteredSpot>;
  fetchPrefecture?: (lat: number, lng: number) => Promise<string | null>;
}) {
  const [position, setPosition] = useState({ lat: 0, lng: 0 });
  const [locked, setLocked] = useState<RegisteredSpot | null>(null);
  return (
    <>
      <button type="button" onClick={() => setPosition({ lat: 34.95, lng: 135.76 })}>
        地図を動かす
      </button>
      <p>いまの中心: {position.lat}</p>
      {locked && <p>固定: {locked.name}</p>}
      <SpotField
        lockedSpot={locked}
        resolvedSpot={null}
        newPlaceName=""
        onLock={setLocked}
        onUnlock={() => setLocked(null)}
        onNewPlaceNameChange={() => {}}
        position={position}
        onMoveMapTo={setPosition}
        registerSpot={registerSpot}
        fetchPrefecture={fetchPrefecture}
        searchSpots={async () => ({ candidates: [GOOGLE_CANDIDATE], placesUnavailable: false })}
      />
    </>
  );
}

async function openConfirm() {
  fireEvent.click(screen.getByRole("button", { name: "変更" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "伏見" } });
  fireEvent.click(await screen.findByRole("button", { name: "伏見稲荷大社" }));
  await screen.findByText("この場所でよいか確かめてください");
}

describe("確定の一手（#700）", () => {
  it("候補を選んでも、その場では登録しない", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    expect(registerSpot).not.toHaveBeenCalled();
  });

  it("候補を選ぶと地図がその位置へ動く", async () => {
    render(<Harness registerSpot={async () => REGISTERED} />);
    await openConfirm();
    expect(screen.getByText(`いまの中心: ${GOOGLE_CANDIDATE.lat}`)).toBeInTheDocument();
  });

  it("保存するのは Google が返した座標ではなく、確定した時点の地図の中心", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "地図を動かす" }));
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    await waitFor(() =>
      expect(registerSpot).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 34.95, lng: 135.76, placeId: "ChIJ-fushimi" })
      )
    );
  });

  it("名前を直して確定すると、直した名前で登録する", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    fireEvent.change(screen.getByLabelText("場所の名前"), { target: { value: "伏見稲荷（千本鳥居）" } });
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    await waitFor(() =>
      expect(registerSpot).toHaveBeenCalledWith(expect.objectContaining({ name: "伏見稲荷（千本鳥居）" }))
    );
  });

  it("都道府県はあらかじめ埋まり、選び直せる", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    const select = screen.getByLabelText("都道府県");
    await waitFor(() => expect(select).toHaveValue("京都府"));
    fireEvent.change(select, { target: { value: "奈良県" } });
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    await waitFor(() =>
      expect(registerSpot).toHaveBeenCalledWith(expect.objectContaining({ prefecture: "奈良県" }))
    );
  });

  it("都道府県が引けなくても確定できる（選ばないまま送る）", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} fetchPrefecture={async () => null} />);
    await openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    await waitFor(() =>
      expect(registerSpot).toHaveBeenCalledWith(expect.objectContaining({ prefecture: null }))
    );
  });

  it("確定すると、そのスポットに固定される", async () => {
    render(<Harness registerSpot={async () => REGISTERED} />);
    await openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    expect(await screen.findByText("固定: 伏見稲荷大社")).toBeInTheDocument();
  });

  it("「やめる」で元に戻り、登録もしない", async () => {
    const registerSpot = vi.fn(async () => REGISTERED);
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    await waitFor(() => expect(screen.queryByText("この場所でよいか確かめてください")).not.toBeInTheDocument());
    expect(registerSpot).not.toHaveBeenCalled();
  });

  it("登録できなかったら、その場で伝えて確定待ちのまま残す", async () => {
    const registerSpot = vi.fn(async () => {
      throw new Error("register_failed");
    });
    render(<Harness registerSpot={registerSpot} />);
    await openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "この位置で確定" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("登録できませんでした");
    expect(screen.getByText("この場所でよいか確かめてください")).toBeInTheDocument();
  });

  it("Google の表記を出す（候補の名前が Google 由来なので）", async () => {
    render(<Harness registerSpot={async () => REGISTERED} />);
    await openConfirm();
    expect(document.querySelector("[data-google-maps-attribution]")).toBeInTheDocument();
  });
});
