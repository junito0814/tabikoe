import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds, isBlockedEitherWay } from "./get-blocked-user-ids";

/**
 * 出典: docs/tasks/safety/blocking/02-blocked-content-filter-helper.md 単体テスト
 * - 双方向（自分がブロックした相手／自分をブロックした相手）のIDが取得されること
 * - アルバム文脈フラグで除外リストが適用されないこと（3.8.2の例外）
 */
type BlockRow = { blocker_id: string; blocked_id: string };

/**
 * blocks への問い合わせだけを模したクライアント。
 * getBlockedUserIds は `.select().or()` を、isBlockedEitherWay は `.select().or().limit()` を await する。
 */
function fakeAdmin(rows: BlockRow[] | Error) {
  const result =
    rows instanceof Error
      ? { data: null, error: { message: rows.message } }
      : { data: rows, error: null };

  const or = vi.fn(() => {
    // `.or()` 自体が thenable として結果を返し、さらに `.limit()` も持つ
    const thenable = Promise.resolve(result) as Promise<typeof result> & {
      limit: () => Promise<typeof result>;
    };
    thenable.limit = vi.fn(async () => result);
    return thenable;
  });

  const client = {
    from: vi.fn(() => ({ select: vi.fn(() => ({ or })) })),
  } as unknown as SupabaseClient;

  return { client, or };
}

describe("getBlockedUserIds", () => {
  it("自分がブロックした相手と、自分をブロックした相手の両方を返す", async () => {
    const { client } = fakeAdmin([
      { blocker_id: "me", blocked_id: "a" }, // 自分がブロック
      { blocker_id: "b", blocked_id: "me" }, // 自分がブロックされた
    ]);

    expect((await getBlockedUserIds(client, "me")).sort()).toEqual(["a", "b"]);
  });

  it("同じ相手と双方向にブロック関係があっても1件に畳む", async () => {
    const { client } = fakeAdmin([
      { blocker_id: "me", blocked_id: "a" },
      { blocker_id: "a", blocked_id: "me" },
    ]);

    expect(await getBlockedUserIds(client, "me")).toEqual(["a"]);
  });

  it("ブロック関係が無ければ空配列", async () => {
    const { client } = fakeAdmin([]);
    expect(await getBlockedUserIds(client, "me")).toEqual([]);
  });

  it("アルバム文脈ではDBに問い合わせず空配列を返す（3.8.2の例外）", async () => {
    const { client, or } = fakeAdmin([{ blocker_id: "me", blocked_id: "a" }]);

    expect(await getBlockedUserIds(client, "me", { albumContext: true })).toEqual([]);
    expect(or).not.toHaveBeenCalled();
  });

  it("取得に失敗した場合は例外を投げる（呼び出し側が503等に変換する）", async () => {
    const { client } = fakeAdmin(new Error("db down"));
    await expect(getBlockedUserIds(client, "me")).rejects.toBeDefined();
  });
});

describe("isBlockedEitherWay", () => {
  it("どちらの方向でもブロック関係があれば true", async () => {
    const { client } = fakeAdmin([{ blocker_id: "other", blocked_id: "me" }]);
    expect(await isBlockedEitherWay(client, "me", "other")).toBe(true);
  });

  it("関係が無ければ false", async () => {
    const { client } = fakeAdmin([]);
    expect(await isBlockedEitherWay(client, "me", "other")).toBe(false);
  });
});
