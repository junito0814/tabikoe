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
  fireEvent.change(screen.getByLabelText("アルバム *"), { target: { value: "大阪旅行" } });
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
