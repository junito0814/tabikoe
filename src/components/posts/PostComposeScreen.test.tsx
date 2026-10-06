/**
 * 出典: docs/tasks/posts/post-creation-v3/03-split-screen-layout.md（単体テスト）
 *       docs/tasks/posts/spot-selection-v3/04-change-spot-by-name.md（自宅保護の 4 分岐）
 *       docs/tasks/posts/draft/02-draft-ui-autosave.md（#591 で自動保存は廃止。要件 3.3.7）
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }) }));

type BoundsHandler = (bounds: unknown, center: { lat: number; lng: number }) => void;
let lastOnBoundsChange: BoundsHandler | undefined;
vi.mock("@/components/map/GoogleMap", () => ({
  GoogleMap: (props: { onBoundsChange?: BoundsHandler }) => {
    lastOnBoundsChange = props.onBoundsChange;
    return <div data-testid="google-map" />;
  },
}));

import { PostComposeScreen, type ComposeApi } from "./PostComposeScreen";
import { buildComposeInitialState } from "@/lib/posts/compose-initial-state";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function makeApi(overrides: Partial<ComposeApi> = {}): ComposeApi {
  return {
    upload: vi.fn(async () => jsonResponse({ media: [{ mediaType: "photo", storagePath: "p1", videoPath: null, durationSeconds: null }] }, 201)),
    create: vi.fn(async () => jsonResponse({ postId: "new-post", newBadges: [] }, 201)),
    update: vi.fn(async () => jsonResponse({ postId: "new-post", newBadges: [] })),
    attachMedia: vi.fn(async () => jsonResponse({ added: 1 }, 201)),
    deletePhoto: vi.fn(async () => jsonResponse({}, 200)),
    resolveSpot: vi.fn(async () => null),
    ...overrides,
  };
}

const currentLocation = buildComposeInitialState({ lat: "35.6", lng: "139.7", from: "current" });

async function fillRequired() {
  fireEvent.change(screen.getByLabelText("アルバム（任意）"), { target: { value: "大阪旅行" } });
  fireEvent.change(screen.getByLabelText("カテゴリ *"), { target: { value: "グルメ" } });
  fireEvent.change(screen.getByLabelText("滞在時間 *"), { target: { value: "1時間以内" } });
  fireEvent.click(screen.getByRole("radio", { name: "4" }));
  const input = screen.getByLabelText("写真・動画を選択") as HTMLInputElement;
  const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockReset();
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PostComposeScreen", () => {
  it("上 1/3 の地図と下部固定の「投稿する」「下書きに保存」がある", () => {
    render(<PostComposeScreen initial={currentLocation} api={makeApi()} />);
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "投稿する" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下書きに保存" })).toBeInTheDocument();
  });

  it("現在地由来・未移動・新しい場所のまま投稿すると自宅保護の確認が出る（4 分岐の 1）", async () => {
    const api = makeApi();
    render(<PostComposeScreen initial={currentLocation} api={api} />);
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
    expect(screen.getByRole("dialog", { name: "この位置を公開しますか？" })).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "場所を変える" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("地図を動かしていれば確認なしで投稿し、投稿詳細へ遷移する（4 分岐の 2）", async () => {
    const api = makeApi();
    render(<PostComposeScreen initial={currentLocation} api={api} />);
    act(() => lastOnBoundsChange?.({}, { lat: 35.6, lng: 139.7 }));
    act(() => lastOnBoundsChange?.({}, { lat: 35.61, lng: 139.7 }));
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const payload = vi.mocked(api.create).mock.calls[0][0] as { status: string; lat: number };
    expect(payload.status).toBe("published");
    expect(payload.lat).toBeCloseTo(35.61);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new-post?posted=1"));
  });

  it("長押しなど現在地由来でない位置なら確認は出ない（4 分岐の 3）", async () => {
    const api = makeApi();
    render(<PostComposeScreen initial={buildComposeInitialState({ lat: "35.6", lng: "139.7" })} api={api} />);
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
  });

  it("「下書きに保存」は必須項目が空でも status=draft で保存し、マイページへ", async () => {
    const api = makeApi();
    render(<PostComposeScreen initial={currentLocation} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "下書きに保存" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect((vi.mocked(api.create).mock.calls[0][0] as { status: string }).status).toBe("draft");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/mypage?draftSaved=1"));
  });

  // #591: 自動保存は廃止。下書きができるのは「下書きに保存」を押したときだけ（要件 3.3.7）
  it("入力しても時間が経つだけでは下書きが作られない", async () => {
    const api = makeApi();
    render(<PostComposeScreen initial={currentLocation} api={api} />);
    fireEvent.change(screen.getByLabelText("感想（任意）"), { target: { value: "メモ" } });
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });
});

describe("loading-feedback Task 3: 押した直後に文言が変わる", () => {
  it("「下書きに保存」は保存中に文言が変わり、投稿ボタンの文言は変わらない", async () => {
    let resolveCreate: (response: Response) => void = () => {};
    const api = makeApi({ create: vi.fn(() => new Promise<Response>((resolve) => { resolveCreate = resolve; })) });
    render(<PostComposeScreen initial={currentLocation} api={api} />);

    fireEvent.click(screen.getByRole("button", { name: "下書きに保存" }));
    // 押した直後に変わる（写真のアップロードを含むので最も長く待つ）
    expect(await screen.findByRole("button", { name: "保存中…" })).toBeInTheDocument();
    // 下書きを保存している間に「送信中...」とは出さない
    expect(screen.getByRole("button", { name: "投稿する" })).toBeInTheDocument();

    resolveCreate(Response.json({ postId: "p1" }, { status: 201 }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
  });
});

/**
 * 本5-1（2026-10-06）: 投稿を書く画面の形
 * - #768: 「アルバム *」が必須の印なのに必須ではなかった
 * - #798: 上 3 行だけ左ラベルで、同じ画面に 2 つの型が混ざっていた
 * - #786: 「スポット名」の中にもう 1 つ「スポット」の小見出しが出ていた
 */
describe("投稿を書く画面の形（#768・#798・#786）", () => {
  it("#768: アルバムは「（任意）」。必須の印は付けない（空なら「日常」に入るため）", async () => {
    render(<PostComposeScreen initial={currentLocation} api={makeApi()} />);
    expect(screen.getByLabelText("アルバム（任意）")).toBeInTheDocument();
    expect(screen.queryByLabelText("アルバム *")).toBeNull();
  });

  it("#798: ラベルは全部「欄の上」。左に 84px のラベルを置かない", async () => {
    const { container } = render(<PostComposeScreen initial={currentLocation} api={makeApi()} />);
    const narrowLabels = Array.from(container.querySelectorAll("label, span")).filter((element) => element.className.includes("w-[84px]"));
    expect(narrowLabels.map((element) => element.textContent)).toEqual([]);
  });

  it("#786: 「変更」を押しても「スポット」の小見出しは増えない（読み上げ用のラベルは残る）", async () => {
    render(<PostComposeScreen initial={currentLocation} api={makeApi()} />);
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    // 見える小見出しは外側の「スポット名 *」だけ
    const visible = Array.from(document.querySelectorAll("label, span")).filter(
      (element) => !element.className.includes("sr-only") && element.textContent?.trim() === "スポット"
    );
    expect(visible).toEqual([]);
    expect(screen.getByLabelText("スポット名で探す")).toBeInTheDocument();
  });

  it("#786: 「新しい場所（ピンの位置）にする」と「やめる」が同じ行", async () => {
    render(<PostComposeScreen initial={currentLocation} api={makeApi()} />);
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    const newPlace = screen.getByRole("button", { name: "新しい場所（ピンの位置）にする" });
    const cancel = screen.getByRole("button", { name: "やめる" });
    expect(screen.queryByRole("button", { name: "検索をやめる" })).toBeNull();
    expect(newPlace.parentElement).toBe(cancel.parentElement);
  });
});
