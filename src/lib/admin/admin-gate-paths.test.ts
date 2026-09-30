import { describe, expect, it } from "vitest";
import { adminGatePath } from "./admin-gate-paths";

/** 出典: docs/tasks/admin/admin-login/06-proxy-aal2-gate.md 単体テスト */
describe("adminGatePath", () => {
  it("二段階確認の入口を最初に見分ける（ここに 6 桁を求めると堂々巡りになる）", () => {
    expect(adminGatePath("/admin/mfa")).toBe("mfa_entry");
    expect(adminGatePath("/api/admin/mfa/enroll")).toBe("mfa_entry");
    expect(adminGatePath("/api/admin/mfa/verify")).toBe("mfa_entry");
  });

  it("管理者だけが呼ぶ API は api（足りないときは転送ではなく 401）", () => {
    expect(adminGatePath("/api/admin")).toBe("api");
    expect(adminGatePath("/api/admin/reports")).toBe("api");
    expect(adminGatePath("/api/admin/users/abc/suspend")).toBe("api");
  });

  it("管理画面は page（足りないときは SC-32 へ送る）", () => {
    expect(adminGatePath("/admin")).toBe("page");
    expect(adminGatePath("/admin/reports")).toBe("page");
    expect(adminGatePath("/admin/users/abc")).toBe("page");
  });

  it("関係ないアドレスは対象外", () => {
    expect(adminGatePath("/")).toBeNull();
    expect(adminGatePath("/mypage")).toBeNull();
    expect(adminGatePath("/api/posts")).toBeNull();
    expect(adminGatePath("/api/legal/consent")).toBeNull();
  });

  it("似た名前の API を取り違えない", () => {
    // /api/admin-x は管理 API ではない
    expect(adminGatePath("/api/admin-x")).toBeNull();
    // /api/admin/mfax は二段階確認の入口ではない（素通しさせない）
    expect(adminGatePath("/api/admin/mfax")).toBe("api");
    // /admin/mfax も同じ（SC-32 ではないので 6 桁を求める）
    expect(adminGatePath("/admin/mfax")).toBe("page");
  });
});
