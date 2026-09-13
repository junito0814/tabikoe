import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCommentPage, listComments, type CommentRow } from "./list-comments";

/**
 * 出典: docs/tasks/browsing/comments/03-comment-list-handler.md 単体テスト
 * - コメントが21件以上ある投稿で、1回目の取得が20件、2回目の取得（ページング）で残りが取得できることを検証する
 * - コメントが新着順で返ることを検証する
 * 出典: docs/tasks/browsing/comments/06-comment-ui.md
 * - 自分のコメントにのみ削除ボタンが表示される（isMine の判定）
 */
const row = (i: number, userId = "u"): CommentRow => ({
  id: `c${i}`,
  user_id: userId,
  body: `本文${i}`,
  created_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
  users: { display_name: "たろう", avatar_url: null, is_deleted: false },
});

/** created_at 降順で並んだ全件を持ち、range で切り出す偽の admin */
function fakeAdmin(all: CommentRow[]) {
  const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at));
  let from = 0;
  let to = 0;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "not"]) q[m] = () => q;
  q.range = (f: number, t: number) => {
    from = f;
    to = t;
    return q;
  };
  q.then = (resolve: (v: unknown) => void) =>
    resolve({ data: sorted.slice(from, to + 1), error: null, count: sorted.length });
  return {
    from: (table: string) =>
      table === "blocks"
        ? { select: () => ({ or: async () => ({ data: [], error: null }) }) }
        : q,
  } as unknown as SupabaseClient;
}

describe("listComments", () => {
  const all = Array.from({ length: 23 }, (_, i) => row(i));

  it("1回目は20件、2回目で残り3件が取れる", async () => {
    const admin = fakeAdmin(all);
    const first = await listComments(admin, "me", "p1", 0);
    expect(first.comments).toHaveLength(20);
    expect(first.nextOffset).toBe(20);
    expect(first.totalCount).toBe(23);

    const second = await listComments(admin, "me", "p1", first.nextOffset!);
    expect(second.comments).toHaveLength(3);
    expect(second.nextOffset).toBeNull();
  });

  it("新着順で返る", async () => {
    const page = await listComments(fakeAdmin(all), "me", "p1", 0);
    expect(page.comments[0].id).toBe("c22");
    expect(page.comments[19].id).toBe("c3");
  });
});

describe("buildCommentPage", () => {
  it("自分のコメントだけ isMine、退会済みは匿名化、本文はエスケープを戻す", () => {
    const rows: CommentRow[] = [
      { ...row(1, "me"), body: "&lt;b&gt;太字&lt;/b&gt;" },
      { ...row(2, "gone"), users: { display_name: "本名", avatar_url: "x", is_deleted: true } },
    ];
    const page = buildCommentPage(rows, "me", 0, 2);
    expect(page.comments[0]).toMatchObject({ isMine: true, body: "<b>太字</b>" });
    expect(page.comments[1]).toMatchObject({
      isMine: false,
      author: { displayName: "退会済みユーザー", avatarUrl: "/default-avatar.svg", isDeleted: true },
    });
    expect(page.nextOffset).toBeNull();
  });
});
