import { afterEach, describe, expect, it, vi } from "vitest";
import { isE2eEnabled } from "./enabled";
import { parseE2eLoginTarget } from "./seed-users";
import { POST } from "@/app/api/e2e/login/route";

/**
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md「テスト要件 › 単体テスト」
 *
 * テスト専用のログイン経路が**本番で絶対に有効にならない**ことを固定する。
 */
describe("isE2eEnabled", () => {
  it('"1" のときだけ有効', () => {
    expect(isE2eEnabled("1")).toBe(true);
  });

  it("未設定・空・\"0\"・\"true\"・\"2\" はすべて無効", () => {
    for (const value of [undefined, "", "0", "true", "2", " 1", "1 ", "yes"]) {
      expect(isE2eEnabled(value)).toBe(false);
    }
  });
});

describe("parseE2eLoginTarget", () => {
  it('"user" と "admin" の印だけを受け付ける', () => {
    expect(parseE2eLoginTarget({ as: "user" })).toBe("user");
    expect(parseE2eLoginTarget({ as: "admin" })).toBe("admin");
  });

  it("メールアドレス・ID・ほかの印・形の違うものはすべて断る", () => {
    expect(parseE2eLoginTarget({ as: "someone@example.com" })).toBeNull();
    expect(parseE2eLoginTarget({ email: "taro@e2e.invalid" })).toBeNull();
    expect(parseE2eLoginTarget({ as: "00000000-0000-4000-8000-0000000000e1" })).toBeNull();
    expect(parseE2eLoginTarget({ as: "root" })).toBeNull();
    expect(parseE2eLoginTarget("user")).toBeNull();
    expect(parseE2eLoginTarget(null)).toBeNull();
    expect(parseE2eLoginTarget(["user"])).toBeNull();
  });
});

describe("POST /api/e2e/login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const request = () => new Request("http://localhost/api/e2e/login", { method: "POST", body: JSON.stringify({ as: "user" }) });

  it("E2E_TEST が未設定なら 404（入口があることすら出さない）", async () => {
    vi.stubEnv("E2E_TEST", undefined);
    const response = await POST(request());
    expect(response.status).toBe(404);
  });

  it('E2E_TEST が "1" 以外でも 404', async () => {
    vi.stubEnv("E2E_TEST", "true");
    expect((await POST(request())).status).toBe(404);
  });

  it("Vercel の上では E2E_TEST=1 でも 404（二重の守り）", async () => {
    vi.stubEnv("E2E_TEST", "1");
    vi.stubEnv("VERCEL", "1");
    expect((await POST(request())).status).toBe(404);
  });
});
