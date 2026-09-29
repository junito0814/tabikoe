import { describe, expect, it } from "vitest";
import { ADMIN_HOME_PATH, ADMIN_MFA_PATH, buildAdminMfaPath, safeAdminRedirect } from "./mfa-redirect";

/** 出典: docs/tasks/admin/admin-login/05-mfa-screen.md 単体テスト（redirect_to の検証） */
describe("safeAdminRedirect", () => {
  it("/admin 配下はそのまま使う（クエリも残す）", () => {
    expect(safeAdminRedirect("/admin")).toBe("/admin");
    expect(safeAdminRedirect("/admin/reports")).toBe("/admin/reports");
    expect(safeAdminRedirect("/admin/reports?status=open&sort=old")).toBe("/admin/reports?status=open&sort=old");
    expect(safeAdminRedirect("/admin/users/abc-123")).toBe("/admin/users/abc-123");
  });

  it("外部へ飛ばそうとする値は既定に落とす", () => {
    expect(safeAdminRedirect("https://example.com/admin")).toBe(ADMIN_HOME_PATH);
    // プロトコル相対。ブラウザは外部サイトとして解釈する
    expect(safeAdminRedirect("//example.com")).toBe(ADMIN_HOME_PATH);
    // ブラウザが \ を / に直すため、これも外部へ出る抜け道になる
    expect(safeAdminRedirect("/\\example.com")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("/admin\\..\\..")).toBe(ADMIN_HOME_PATH);
  });

  it("/admin 配下でないもの・「/admin で始まるだけ」の別のパスは既定に落とす", () => {
    expect(safeAdminRedirect("/")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("/mypage")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("/admin-secret")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("/administrator")).toBe(ADMIN_HOME_PATH);
  });

  it("クエリに紛れ込ませても、判定はパスだけで行う", () => {
    expect(safeAdminRedirect("/mypage?next=/admin")).toBe(ADMIN_HOME_PATH);
  });

  it("二段階確認の画面そのものは既定に落とす（堂々巡りを防ぐ）", () => {
    expect(safeAdminRedirect(ADMIN_MFA_PATH)).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("/admin/mfa?redirect_to=/admin/reports")).toBe(ADMIN_HOME_PATH);
  });

  it("文字列でない・空の値は既定に落とす", () => {
    expect(safeAdminRedirect(undefined)).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect(null)).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect("")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect(["/admin/reports"])).toBe(ADMIN_HOME_PATH);
    expect(safeAdminRedirect(42)).toBe(ADMIN_HOME_PATH);
  });
});

describe("buildAdminMfaPath", () => {
  it("元の場所を redirect_to に残す", () => {
    expect(buildAdminMfaPath("/admin/reports")).toBe("/admin/mfa?redirect_to=%2Fadmin%2Freports");
  });

  it("既定に落ちる行き先なら redirect_to を付けない", () => {
    expect(buildAdminMfaPath("/admin")).toBe(ADMIN_MFA_PATH);
    expect(buildAdminMfaPath("/mypage")).toBe(ADMIN_MFA_PATH);
  });
});
