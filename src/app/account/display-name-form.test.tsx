import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DisplayNameForm from "./display-name-form";

/**
 * 出典: docs/tasks/account/profile-edit/02-display-name-edit-ui.md 単体テスト
 * - 文字数カウントが書記素クラスタ単位であること
 * - 200文字超過時に保存ボタンが無効化されること
 * - 保存ボタン押下でAPI（モック）が呼ばれること
 */
const fetchMock = vi.fn();

vi.mock("@/lib/api/fetch-with-auth-redirect", () => ({
  fetchWithAuthRedirect: (...args: unknown[]) => fetchMock(...args),
  UnauthorizedError: class extends Error {},
}));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
});

describe("DisplayNameForm", () => {
  it("初期値と文字数を表示する", () => {
    render(<DisplayNameForm initialDisplayName="太郎" />);
    expect(screen.getByRole("textbox")).toHaveValue("太郎");
    expect(screen.getByText("2 / 200")).toBeInTheDocument();
  });

  it("文字数は書記素クラスタ単位で数える（絵文字は1文字）", () => {
    render(<DisplayNameForm initialDisplayName="太郎👨‍👩‍👧" />);
    expect(screen.getByText("3 / 200")).toBeInTheDocument();
  });

  it("200文字ちょうどは保存できる", () => {
    render(<DisplayNameForm initialDisplayName={"あ".repeat(199)} />);
    // #783: 変えたときだけ押せる
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "あ".repeat(200) } });
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  /**
   * #783（2026-10-06）: 「保存」が何も変えていなくても押せた。
   * 押しても同じ値を送るだけで見た目は何も起きないので、「効かないボタン」に見える。
   */
  it("#783: 名前を変えていないときは「保存」を押せない", () => {
    render(<DisplayNameForm initialDisplayName="太郎" />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "花子" } });
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    // 元に戻したらまた押せない
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "太郎" } });
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("201文字では保存ボタンが無効化される", () => {
    render(<DisplayNameForm initialDisplayName={"あ".repeat(201)} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByText("201 / 200")).toBeInTheDocument();
  });

  it("保存ボタン押下でPATCH /api/users/me が呼ばれる", async () => {
    render(<DisplayNameForm initialDisplayName="太郎" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "花子" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ displayName: "花子" });
  });

  it("保存成功時にメッセージを表示する", async () => {
    render(<DisplayNameForm initialDisplayName="太郎" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "花子" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("保存失敗時にメッセージを表示する", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<DisplayNameForm initialDisplayName="太郎" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "花子" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });
});
