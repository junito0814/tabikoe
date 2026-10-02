import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NEW_PLACE_LABEL, RESOLVING_LABEL, SpotField } from "./SpotField";
import type { NearbySpot } from "@/lib/spots/nearby";
import type { RegisteredSpot } from "@/lib/spots/types";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-5）
 * 要件定義書 4.5.11 の場面 4・8 章 90
 *
 * 【初心者向け】地図を動かすと 300ms 後に「50m 以内の登録済みスポット」を調べ、
 * **スポット名が無言で入れ替わっていた**。待っている間は前の名前のままなので、
 * 動かしたのに何も起きていないように見え、名前が変わった瞬間に驚かされる。
 */
const RESOLVED: NearbySpot = { id: "s-1", name: "首里城", lat: 26.2, lng: 127.7, prefecture: "沖縄県", source: "manual", distance_meters: 20 };
const LOCKED: RegisteredSpot = { id: "s-2", name: "美ら海水族館", lat: 26.6, lng: 127.8, prefecture: "沖縄県", source: "manual" };

const base = {
  newPlaceName: "",
  onLock: vi.fn(),
  onUnlock: vi.fn(),
  onNewPlaceNameChange: vi.fn(),
};

describe("4-5: スポットの照合中", () => {
  it("照合中は「近くのスポットを探しています…」を出す", () => {
    render(<SpotField {...base} lockedSpot={null} resolvedSpot={null} isResolving />);
    expect(screen.getByText(RESOLVING_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(NEW_PLACE_LABEL)).toBeNull();
  });

  it("照合中は前に見つかっていた名前を出さない（無言で入れ替わらないように）", () => {
    render(<SpotField {...base} lockedSpot={null} resolvedSpot={RESOLVED} isResolving />);
    expect(screen.getByText(RESOLVING_LABEL)).toBeInTheDocument();
    expect(screen.queryByText("首里城")).toBeNull();
  });

  it("照合中は「場所の名前」の入力欄を出さない（直後に引っこむため）", () => {
    render(<SpotField {...base} lockedSpot={null} resolvedSpot={null} isResolving />);
    expect(screen.queryByLabelText("新しい場所の名前（任意）")).toBeNull();
  });

  it("照合が終わったら見つかった名前を出す", () => {
    render(<SpotField {...base} lockedSpot={null} resolvedSpot={RESOLVED} />);
    expect(screen.getByText("首里城")).toBeInTheDocument();
    expect(screen.queryByText(RESOLVING_LABEL)).toBeNull();
  });

  it("見つからなかったら「新しい場所」になり、名前の入力欄が出る", () => {
    render(<SpotField {...base} lockedSpot={null} resolvedSpot={null} />);
    expect(screen.getByText(NEW_PLACE_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText("新しい場所の名前（任意）")).toBeInTheDocument();
  });

  it("固定しているスポットがあれば、照合中でもその名前を出す（固定中は照合しないため）", () => {
    render(<SpotField {...base} lockedSpot={LOCKED} resolvedSpot={null} isResolving />);
    expect(screen.getByText("美ら海水族館")).toBeInTheDocument();
    expect(screen.queryByText(RESOLVING_LABEL)).toBeNull();
  });
});
