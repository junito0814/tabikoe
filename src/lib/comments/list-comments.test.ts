import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCommentPage, buildCommentTree, listComments, type CommentRow } from "./list-comments";

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
  // v3.2: 返信の取得（in）は空で返す。同じ q を使い回すので、in を呼んだ直後の then だけ空にする
  let replies = false;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "not", "is"]) q[m] = () => q;
  q.in = () => {
    replies = true;
    return q;
  };
  q.range = (f: number, t: number) => {
    from = f;
    to = t;
    return q;
  };
  q.then = (resolve: (v: unknown) => void) => {
    if (replies) {
      replies = false;
      return resolve({ data: [], error: null, count: 0 });
    }
    return resolve({ data: sorted.slice(from, to + 1), error: null, count: sorted.length });
  };
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
    const page = buildCommentPage(rows, "me", 0, 2, 2);
    expect(page.comments[0]).toMatchObject({ isMine: true, body: "<b>太字</b>" });
    expect(page.comments[1]).toMatchObject({
      isMine: false,
      author: { displayName: "退会済みユーザー", avatarUrl: "/default-avatar.svg", isDeleted: true },
    });
    expect(page.nextOffset).toBeNull();
  });
});

describe("buildCommentTree（v3.2: 返信）", () => {
  it("返信は root_id で親にぶら下がり古い順、返信への返信も同じ段。「@名前 への返信」は返信先の名前", () => {
    const top = row(1, "a");
    const r1: CommentRow = { ...row(2, "b"), parent_id: "c1", root_id: "c1", users: { display_name: "びー", avatar_url: null, is_deleted: false } };
    const r2: CommentRow = { ...row(3, "a"), parent_id: "c2", root_id: "c1" };
    const tree = buildCommentTree([top], [r2, r1], "me");
    expect(tree).toHaveLength(1);
    expect(tree[0].replies.map((r) => r.id)).toEqual(["c2", "c3"]);
    expect(tree[0].replies[0].replyToName).toBe("たろう");
    expect(tree[0].replies[1].replyToName).toBe("びー");
    expect(tree[0].replies[1].parentId).toBe("c2");
  });

  it("削除された親は枠だけ（deleted・本文なし・isMine なし）で、返信は残る", () => {
    const top: CommentRow = { ...row(1, "me"), deleted_at: "2026-09-19T00:00:00Z" };
    const reply: CommentRow = { ...row(2, "b"), parent_id: "c1", root_id: "c1" };
    const tree = buildCommentTree([top], [reply], "me");
    expect(tree[0]).toMatchObject({ deleted: true, body: "", isMine: false });
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].replyToName).toBe("削除されたコメント");
  });
});
