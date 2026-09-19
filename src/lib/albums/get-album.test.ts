import { describe, expect, it } from "vitest";
import { filterAlbumsWithPosts, sortAlbumsDailyFirst, toAlbumMembers } from "./get-album";

/**
 * 出典: docs/tasks/posts/post-delete/02-empty-album-hiding.md 単体テスト
 * - 投稿0件の旅行が結果セットから除外される条件式が正しく組み立てられることを検証する
 * 出典: docs/tasks/records/album/02-album-members-list.md 単体テスト
 * - album_members のレコードが、ロールとユーザー情報を伴って正しく整形されることを検証する
 */
describe("filterAlbumsWithPosts", () => {
  it("投稿0件のアルバムを除外し、1件以上は残す", () => {
    const albums = [
      { tripId: "a", postCount: 0 },
      { tripId: "b", postCount: 1 },
      { tripId: "c", postCount: 12 },
    ];
    expect(filterAlbumsWithPosts(albums).map((album) => album.tripId)).toEqual(["b", "c"]);
  });

  it("v3.1: 「日常」は投稿 0 件でも残す", () => {
    const albums = [
      { tripId: "daily", postCount: 0, isDaily: true },
      { tripId: "a", postCount: 0, isDaily: false },
      { tripId: "b", postCount: 2, isDaily: false },
    ];
    expect(filterAlbumsWithPosts(albums).map((album) => album.tripId)).toEqual(["daily", "b"]);
  });
});

describe("sortAlbumsDailyFirst", () => {
  it("v3.1: 「日常」が先頭、残りは最新投稿順", () => {
    const sorted = sortAlbumsDailyFirst([
      { tripId: "old", isDaily: false, updatedAt: "2026-09-01T00:00:00Z" },
      { tripId: "new", isDaily: false, updatedAt: "2026-09-10T00:00:00Z" },
      { tripId: "daily", isDaily: true, updatedAt: null },
    ]);
    expect(sorted.map((album) => album.tripId)).toEqual(["daily", "new", "old"]);
  });
});

describe("toAlbumMembers", () => {
  it("ロール順（オーナー→編集者→閲覧者）に並び、ユーザー情報を結合する", () => {
    const members = toAlbumMembers([
      { user_id: "v", role: "viewer", joined_at: "2026-09-02T00:00:00Z", users: { display_name: "みる", avatar_url: null, is_deleted: false } },
      { user_id: "o", role: "owner", joined_at: "2026-09-01T00:00:00Z", users: { display_name: "おーなー", avatar_url: "https://x/o.jpg", is_deleted: false } },
      { user_id: "e", role: "editor", joined_at: "2026-09-03T00:00:00Z", users: { display_name: "本名", avatar_url: "https://x/e.jpg", is_deleted: true } },
    ]);
    expect(members.map((member) => member.role)).toEqual(["owner", "editor", "viewer"]);
    expect(members[0]).toMatchObject({ userId: "o", displayName: "おーなー", avatarUrl: "https://x/o.jpg" });
    expect(members[1]).toMatchObject({ displayName: "退会済みユーザー", avatarUrl: "/default-avatar.svg", isDeleted: true });
    expect(members[2]).toMatchObject({ displayName: "みる", avatarUrl: "/default-avatar.svg" });
  });
});
