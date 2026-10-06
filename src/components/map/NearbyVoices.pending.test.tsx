import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NearbyVoices } from "./NearbyVoices";
import type { NearbySpot } from "@/lib/posts/nearby-spots";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-2）
 * 要件定義書 4.5.11 の場面 4・8 章 90
 *
 * 【初心者向け】移動手段を変えても、新しい結果が届くまで**古いカードと古い分数が残っていた**。
 * 見ている人には「変わっていない」ように映る。切り替えた時点で前の結果を捨てることを確かめる。
 */
const post = (id: string, minutes: number): NearbySpot => ({
  // #769: カードはスポット単位になったので、鍵はスポットの id
  spotId: id,
  spotName: `スポット ${id}`,
  latestComment: null, postCount: 1, averageRating: null,
  thumbnailUrl: null,
  lat: 35.68,
  lng: 139.76,
  distanceMeters: 100,
  walkMinutes: minutes,
  minutes,
  mode: "walk",
});

const CENTER = { lat: 35.68, lng: 139.76 };

describe("4-2: 近くのコエの移動手段の切替", () => {
  it("移動手段を変えた直後に古いカードが消え、読み込み表示になる", async () => {
    // 【初心者向け】`| null` で初期化すると TS が「null にしか代入されない」と読んで
    // `never` に狭め、あとで呼べなくなる。空の関数を初期値にして型を保つ
    let pendingResolve: (posts: NearbySpot[]) => void = () => {};
    const fetchPosts = vi.fn(async (_center: typeof CENTER, mode: string) => {
      if (mode === "walk") return [post("a", 3)];
      // 車に変えたぶんは、テストが解放するまで返さない
      return new Promise<NearbySpot[]>((resolve) => {
        pendingResolve = resolve;
      });
    });

    render(<NearbyVoices center={CENTER} fetchPosts={fetchPosts} />);
    // 徒歩の結果が出ている
    expect(await screen.findByText("スポット a")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("移動手段"), { target: { value: "car" } });

    // 古いカードは消え、読み込み表示になる
    await waitFor(() => expect(screen.queryByText("スポット a")).not.toBeInTheDocument());
    expect(screen.getByText("読み込んでいます…")).toBeInTheDocument();

    // 新しい結果が届いたら入れ替わる
    pendingResolve([post("b", 9)]);
    expect(await screen.findByText("スポット b")).toBeInTheDocument();
    expect(screen.queryByText("読み込んでいます…")).not.toBeInTheDocument();
  });

  it("取得に失敗したときは読み込み表示を残さない", async () => {
    const fetchPosts = vi.fn(async () => {
      throw new Error("boom");
    });
    render(<NearbyVoices center={CENTER} fetchPosts={fetchPosts} />);
    expect(await screen.findByText("近くの投稿を読み込めませんでした")).toBeInTheDocument();
    expect(screen.queryByText("読み込んでいます…")).not.toBeInTheDocument();
  });

  it("取り終えて 0 件のときだけ「投稿はありません」を出す", async () => {
    const fetchPosts = vi.fn(async () => []);
    render(<NearbyVoices center={CENTER} fetchPosts={fetchPosts} />);
    expect(await screen.findByText(/この範囲に投稿はありません/)).toBeInTheDocument();
  });
});
