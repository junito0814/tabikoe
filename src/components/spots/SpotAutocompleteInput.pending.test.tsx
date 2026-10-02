import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { SpotAutocompleteInput, type SpotCandidate } from "./SpotAutocompleteInput";
import type { RegisteredSpot } from "@/lib/spots/types";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-1・4-9）
 * 要件定義書 4.5.11 の場面 3・8 章 89・90
 *
 * 【初心者向け】ここだけは**実害があった**。未登録の候補を押すと `POST /api/spots` を呼ぶのに
 * 押せないようにしていなかったので、続けて押すと同じスポットが 2 つ登録されうる。
 * 「登録の API が 1 回しか呼ばれない」ことを機械で止めておく。
 */
const fetchMock = vi.fn();
vi.mock("@/lib/api/fetch-with-auth-redirect", () => ({
  fetchWithAuthRedirect: (...args: unknown[]) => fetchMock(...args),
  UnauthorizedError: class extends Error {},
}));

/** Google 由来で未登録の候補（id が無いので、選ぶと登録が走る） */
const UNREGISTERED: SpotCandidate = {
  id: null,
  name: "新しい展望台",
  lat: 35.68,
  lng: 139.76,
  source: "places",
  postCount: 0,
};

function Harness({ searchSpots }: { searchSpots: (query: string) => Promise<{ candidates: SpotCandidate[]; placesUnavailable: boolean }> }) {
  const [spot, setSpot] = useState<RegisteredSpot | null>(null);
  return <SpotAutocompleteInput selectedSpot={spot} onSelect={setSpot} searchSpots={searchSpots} />;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("4-1: スポット候補の登録中", () => {
  /** 登録の応答を、テストが好きなときに返せるようにする */
  function deferredRegister() {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((r) => {
      resolve = r;
    }));
    return () => resolve({ ok: true, status: 200, json: async () => ({ spot: { id: "spot-9", name: "新しい展望台", lat: 35.68, lng: 139.76, prefecture: null, source: "places" } }) });
  }

  it("押した候補が「登録しています…」になる", async () => {
    deferredRegister();
    render(<Harness searchSpots={async () => ({ candidates: [UNREGISTERED], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    fireEvent.click(await screen.findByRole("button", { name: "新しい展望台" }));
    expect(await screen.findByRole("button", { name: "登録しています…" })).toBeInTheDocument();
  });

  it("登録中は候補を押せない", async () => {
    deferredRegister();
    render(<Harness searchSpots={async () => ({ candidates: [UNREGISTERED], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    fireEvent.click(await screen.findByRole("button", { name: "新しい展望台" }));
    const button = await screen.findByRole("button", { name: "登録しています…" });
    expect(button).toBeDisabled();
  });

  it("続けて押しても登録の API は 1 回しか呼ばれない（二重登録を止める）", async () => {
    deferredRegister();
    render(<Harness searchSpots={async () => ({ candidates: [UNREGISTERED], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    const option = await screen.findByRole("button", { name: "新しい展望台" });
    // disabled の前に 3 回押しても（= disabled をすり抜けても）API は 1 回だけ
    fireEvent.click(option);
    fireEvent.click(option);
    fireEvent.click(option);
    await screen.findByRole("button", { name: "登録しています…" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("登録が終わると押せる状態に戻る（失敗しても固まらない）", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<Harness searchSpots={async () => ({ candidates: [UNREGISTERED], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    fireEvent.click(await screen.findByRole("button", { name: "新しい展望台" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "新しい展望台" })).toBeEnabled());
  });
});

describe("4-9: 候補を探している間", () => {
  it("探している間は「探しています…」を出し、「候補が見つかりません」は出さない", async () => {
    render(<Harness searchSpots={() => new Promise(() => {})} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    expect(await screen.findByText("探しています…")).toBeInTheDocument();
    expect(screen.queryByText(/候補が見つかりません/)).not.toBeInTheDocument();
  });

  it("探し終えて 0 件のときだけ「候補が見つかりません」を出す", async () => {
    render(<Harness searchSpots={async () => ({ candidates: [], placesUnavailable: false })} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "展望台" } });
    expect(await screen.findByText(/候補が見つかりません/)).toBeInTheDocument();
    expect(screen.queryByText("探しています…")).not.toBeInTheDocument();
  });
});
