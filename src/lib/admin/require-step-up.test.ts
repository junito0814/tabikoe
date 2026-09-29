import { beforeEach, describe, expect, it, vi } from "vitest";

/** 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md 単体テスト */
const state = { verifiedAt: null as number | null };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.verifiedAt === null ? undefined : { value: String(state.verifiedAt) }) }),
}));

import { requireStepUp, stepUpRequiredResponse } from "./require-step-up";

const minute = 60 * 1000;
beforeEach(() => {
  state.verifiedAt = null;
});

describe("requireStepUp", () => {
  it("9 分前に 6 桁を入れていれば、そのまま通す", async () => {
    state.verifiedAt = Date.now() - 9 * minute;
    expect(await requireStepUp()).toBeNull();
  });

  it("11 分前なら聞き直す（10 分の期限）", async () => {
    state.verifiedAt = Date.now() - 11 * minute;
    const response = await requireStepUp();
    expect(response?.status).toBe(409);
    expect(await response!.json()).toEqual({ error: "step_up_required" });
  });

  it("一度も入れていなければ聞き直す", async () => {
    state.verifiedAt = null;
    expect((await requireStepUp())?.status).toBe(409);
  });

  it("未来の時刻を書き込まれても通さない（Cookie で期限を延ばせない）", async () => {
    state.verifiedAt = Date.now() + 5 * minute;
    expect((await requireStepUp())?.status).toBe(409);
  });
});

describe("stepUpRequiredResponse", () => {
  it("401 ではなく 409 を返す", async () => {
    const response = stepUpRequiredResponse();
    // 401 にすると画面が「ログインが切れた」と解釈してログイン画面へ飛ばし、
    // 管理者が書いた理由メモが消えてしまう（要件 3.10.1）
    expect(response.status).toBe(409);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ error: "step_up_required" });
  });
});
