import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPERATION_ACTION_TYPES, recordOperation } from "./record-operation";

/**
 * 出典: docs/tasks/data-model/table-catalog/06-operation-logs-table.md
 *       要件定義書7.5（対象操作の列挙）
 *
 * このヘルパーの最重要の契約は「決して例外を投げない」こと。
 * 監査ログの失敗で、記録対象の操作（投稿・ログイン等）を巻き込んではならない。
 */
function fakeAdmin(insertResult: { error: { message: string } | null } | Error) {
  const insert = vi.fn(async () => {
    if (insertResult instanceof Error) throw insertResult;
    return insertResult;
  });
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe("recordOperation", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("operation_logs に action_type・user_id・target_id・detail を書き込む", async () => {
    const { client, from, insert } = fakeAdmin({ error: null });

    await recordOperation(client, {
      actionType: "post_create",
      userId: "user-1",
      targetId: "post-1",
      detail: { visibility: "public" },
    });

    expect(from).toHaveBeenCalledWith("operation_logs");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      action_type: "post_create",
      target_id: "post-1",
      detail: { visibility: "public" },
    });
  });

  it("user_id・target_id・detail は省略時に null で書き込む（ログイン失敗など）", async () => {
    const { client, insert } = fakeAdmin({ error: null });

    await recordOperation(client, { actionType: "login_failure" });

    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      action_type: "login_failure",
      target_id: null,
      detail: null,
    });
  });

  it("insert がエラーを返しても例外を投げず、console.error に残す", async () => {
    const { client } = fakeAdmin({ error: { message: "permission denied" } });

    await expect(
      recordOperation(client, { actionType: "post_delete", userId: "u", targetId: "p" })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "Failed to record operation log",
      "post_delete",
      "permission denied"
    );
  });

  it("insert 自体が throw しても例外を投げない", async () => {
    const { client } = fakeAdmin(new Error("network down"));

    await expect(
      recordOperation(client, { actionType: "account_delete", userId: "u" })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("action_type の一覧が要件7.5の対象操作を網羅している", () => {
    // ログイン成功／失敗、投稿の作成・編集・削除、コメントの投稿・削除、通報、
    // アカウントの登録・退会、管理者による対応操作
    expect(OPERATION_ACTION_TYPES).toEqual(
      expect.arrayContaining([
        "login_success",
        "login_failure",
        "post_create",
        "post_update",
        "post_delete",
        "comment_create",
        "comment_delete",
        "report_create",
        "account_create",
        "account_delete",
        "admin_action",
      ])
    );
  });
});
