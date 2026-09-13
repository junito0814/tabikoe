import { describe, expect, it } from "vitest";
import { canAddPosts, isInvitableRole, resolveAlbumRole } from "./membership";

/**
 * 出典: docs/tasks/records/album/01-album-detail-handler.md
 *       docs/tasks/records/album-collaboration/05-member-role-management-handler.md
 * メンバー判定の純粋部分。
 */
describe("resolveAlbumRole", () => {
  it("album_members の行があればその role", () => {
    expect(resolveAlbumRole({ role: "editor" }, { user_id: "owner" }, "me")).toBe("editor");
  });

  it("行が無くても trips.user_id が本人ならオーナー", () => {
    expect(resolveAlbumRole(null, { user_id: "me" }, "me")).toBe("owner");
  });

  it("行も無く作成者でもなければ null（メンバーでない）", () => {
    expect(resolveAlbumRole(null, { user_id: "owner" }, "me")).toBeNull();
    expect(resolveAlbumRole(null, null, "me")).toBeNull();
  });

  it("不正な role 値は無視する", () => {
    expect(resolveAlbumRole({ role: "admin" }, { user_id: "owner" }, "me")).toBeNull();
  });
});

describe("権限", () => {
  it("投稿を追加できるのはオーナーと編集者", () => {
    expect(canAddPosts("owner")).toBe(true);
    expect(canAddPosts("editor")).toBe(true);
    expect(canAddPosts("viewer")).toBe(false);
    expect(canAddPosts(null)).toBe(false);
  });

  it("招待で付与できるのは editor / viewer のみ", () => {
    expect(isInvitableRole("editor")).toBe(true);
    expect(isInvitableRole("viewer")).toBe(true);
    expect(isInvitableRole("owner")).toBe(false);
  });
});
