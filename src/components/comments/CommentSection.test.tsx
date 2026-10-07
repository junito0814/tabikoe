import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommentSection, type CommentApi } from "./CommentSection";
import type { CommentData } from "@/lib/comments/list-comments";
import { acceptConfirm } from "@/components/ui/confirm-sheet.testing";

/*
 * #874（2026-10-07）: コメントは「コメント N 件」を押すと下から出るシートで読み書きする。
 * ほとんどのテストは**開いた状態**を見たいので、描いてすぐ開く。
 */
function renderOpen(ui: React.ReactElement) {
  const result = render(ui);
  fireEvent.click(document.querySelector("[data-open-comments]") as HTMLElement);
  return result;
}

/**
 * 出典: docs/tasks/browsing/comments/06-comment-ui.md 単体テスト
 * - 自分のコメントにのみ削除ボタンが表示されることを検証する
 * - 「もっと見る」押下で追加のコメントが表示されることを検証する
 */
const comment = (id: string, isMine: boolean, overrides: Partial<CommentData> = {}): CommentData => ({
  id,
  body: `本文${id}`,
  createdAt: "2026-09-14T00:00:00Z",
  author: { id: isMine ? "me" : "other", displayName: isMine ? "わたし" : "だれか", avatarUrl: "/default-avatar.svg", isDeleted: false },
  isMine,
  parentId: null,
  replyToName: null,
  deleted: false,
  replies: [],
  ...overrides,
});

const api = (overrides: Partial<CommentApi> = {}): CommentApi => ({
  fetchPage: vi.fn(async () => ({ comments: [], nextOffset: null, totalCount: 0 })),
  submit: vi.fn(async () => Response.json({ comment: comment("new", true) }, { status: 201 })),
  remove: vi.fn(async () => Response.json({ deleted: true })),
  ...overrides,
});

describe("CommentSection", () => {
  it("自分のコメントにだけ削除ボタンが出る", () => {
    renderOpen(
      <CommentSection
        postId="p1"
        canComment
        returnTo="/posts/p1"
        initialPage={{ comments: [comment("mine", true), comment("theirs", false)], nextOffset: null, totalCount: 2 }}
        api={api()}
      />
    );
    const mine = document.querySelector("[data-comment='mine']")!;
    const theirs = document.querySelector("[data-comment='theirs']")!;
    expect(mine.querySelector("button[aria-label='このコメントを削除']")).not.toBeNull();
    expect(theirs.querySelector("button[aria-label='このコメントを削除']")).toBeNull();
  });

  it("「もっと見る」で次のページのコメントが追加表示される", async () => {
    const fetchPage = vi.fn(async () => ({ comments: [comment("c21", false)], nextOffset: null, totalCount: 21 }));
    renderOpen(
      <CommentSection
        postId="p1"
        canComment
        returnTo="/posts/p1"
        initialPage={{ comments: [comment("c1", false)], nextOffset: 20, totalCount: 21 }}
        api={api({ fetchPage })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith("p1", 20));
    expect(await screen.findByText("本文c21")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull();
  });

  it("投稿すると先頭に追加され、入力欄が空になる", async () => {
    const submit = vi.fn(async () => Response.json({ comment: comment("new", true) }, { status: 201 }));
    renderOpen(
      <CommentSection postId="p1" canComment returnTo="/posts/p1" initialPage={{ comments: [], nextOffset: null, totalCount: 0 }} api={api({ submit })} />
    );
    const textarea = screen.getByRole("textbox", { name: "コメント本文" });
    fireEvent.change(textarea, { target: { value: "こんにちは" } });
    fireEvent.click(screen.getByRole("button", { name: "コメントする" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("p1", "こんにちは", null));
    expect(await screen.findByText("本文new")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });

  it("4,000文字を超えると投稿ボタンが無効になり残数が負で表示される", () => {
    renderOpen(
      <CommentSection postId="p1" canComment returnTo="/posts/p1" initialPage={{ comments: [], nextOffset: null, totalCount: 0 }} api={api()} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "コメント本文" }), { target: { value: "あ".repeat(4001) } });
    expect(screen.getByRole("button", { name: "コメントする" })).toBeDisabled();
    // #772: 数字の前後に半角空白（「投稿 3 件」と同じ書き方）
    expect(screen.getByText(/残り -1 文字/)).toBeInTheDocument();
  });

  it("非公開投稿ではフォームを出さない", () => {
    renderOpen(
      <CommentSection postId="p1" canComment={false} returnTo="/posts/p1" initialPage={{ comments: [], nextOffset: null, totalCount: 0 }} api={api()} />
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("非公開の投稿にはコメントできません")).toBeInTheDocument();
  });
});

describe("CommentSection（v3.2: 返信）", () => {
  const withReplies = (count: number) =>
    comment("root", false, {
      replies: Array.from({ length: count }, (_, i) => comment(`r${i + 1}`, i === 0, { parentId: "root", replyToName: "だれか" })),
    });

  it("返信は親の下に字下げして並び「@名前 への返信」が付く。3 件を超えると「返信をさらに N 件見る」", () => {
    renderOpen(<CommentSection postId="p1" initialPage={{ comments: [withReplies(5)], nextOffset: null, totalCount: 6 }} canComment returnTo="/posts/p1" api={api()} />);
    const replies = document.querySelector("[data-replies='root']") as HTMLElement;
    expect(replies.querySelectorAll("[data-comment]")).toHaveLength(3);
    expect(replies.querySelectorAll("[data-reply-to-name]")[0]).toHaveTextContent("@だれか への返信");
    fireEvent.click(screen.getByRole("button", { name: "返信をさらに 2 件見る" }));
    expect(replies.querySelectorAll("[data-comment]")).toHaveLength(5);
    // 件数は返信を含む
    // #874: 件数はシートを開く入口のボタンに出る（見出しはシートのタイトル）
    expect((document.querySelector("[data-open-comments]") as HTMLElement).textContent).toContain("6 件");
  });

  it("「返信」を押すと @名前 のチップが付き、送信すると parentId 付きで API を呼び、返信の末尾に足される", async () => {
    const submit = vi.fn(async () => Response.json({ comment: comment("new", true, { parentId: "root", replyToName: "だれか" }) }, { status: 201 }));
    renderOpen(<CommentSection postId="p1" initialPage={{ comments: [comment("root", false)], nextOffset: null, totalCount: 1 }} canComment returnTo="/posts/p1" api={api({ submit })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "返信" })[0]);
    expect(document.querySelector("[data-reply-to='root']")).toHaveTextContent("@だれか");
    fireEvent.change(screen.getByLabelText("コメント本文"), { target: { value: "私は 30 分待ちました" } });
    fireEvent.click(screen.getByRole("button", { name: "返信する" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("p1", "私は 30 分待ちました", "root"));
    await waitFor(() => expect(document.querySelector("[data-replies='root'] [data-comment='new']")).toBeInTheDocument());
    expect(document.querySelector("[data-reply-to]")).toBeNull();
    // × で返信モードを解除できる
    fireEvent.click(screen.getAllByRole("button", { name: "返信" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "返信をやめる" }));
    expect(document.querySelector("[data-reply-to]")).toBeNull();
  });

  it("返信がある親を削除すると「削除されたコメント」の枠が残り、返信は読める", async () => {
    const remove = vi.fn(async () => Response.json({ deleted: true, keptFrame: true }));
    const root = comment("root", true, { replies: [comment("r1", false, { parentId: "root", replyToName: "わたし" })] });
    renderOpen(<CommentSection postId="p1" initialPage={{ comments: [root], nextOffset: null, totalCount: 2 }} canComment returnTo="/posts/p1" api={api({ remove })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "このコメントを削除" })[0]);
    await acceptConfirm(); // #778: 確認はアプリ共通のシート（window.confirm ではない）
    await waitFor(() => expect(remove).toHaveBeenCalledWith("root"));
    await waitFor(() => expect(document.querySelector("[data-comment='root'] [data-deleted-comment]")).toBeInTheDocument());
    expect(document.querySelector("[data-comment='r1']")).toBeInTheDocument();
  });
});

/**
 * 本5-4（2026-10-06）: コメント欄
 * - #772: 空のときから「残り4,000文字（4,000文字まで）」と同じ数字が 2 回出ていた
 * - #803: 入力欄が一覧の上にあり、読んでから書くには上まで戻る必要があった
 */
describe("コメント欄（#772・#803）", () => {
  const show = () =>
    renderOpen(<CommentSection postId="p1" canComment returnTo="/posts/p1" initialPage={{ comments: [], nextOffset: null, totalCount: 0 }} api={api()} />);

  it("#772: 空のときは文字数を出さない", () => {
    show();
    expect(document.querySelector("[data-remaining]")).toBeNull();
  });

  it("#772: 打ち始めると「残り 3,999 文字」。「（4,000文字まで）」は出さない", () => {
    show();
    fireEvent.change(screen.getByRole("textbox", { name: "コメント本文" }), { target: { value: "あ" } });
    expect(document.querySelector("[data-remaining]")?.textContent).toBe("残り 3,999 文字");
    expect(document.body.textContent).not.toContain("文字まで");
  });

  /*
   * #803 → #874（2026-10-07）: 入力欄は「読むところより下」のまま。
   * ただしシートの中に入ったので、画面に貼り付ける（fixed）必要が無くなった。
   * シートの footer（一覧の下・常に見える場所）に置いてある。
   */
  it("#874: 入力欄はシートの footer にあり、画面に貼り付けていない", () => {
    show();
    const form = document.querySelector("[data-comment-form]") as HTMLElement;
    expect(form.className).not.toContain("fixed");
    // シートの中にあり、かつ一覧の**外**（スクロールする場所の下＝常に見える footer）
    expect(form.closest('[role="dialog"]')).not.toBeNull();
    expect(form.closest(".overflow-y-auto")).toBeNull();
  });

  it("#803: 返信の札は入力欄の中（上）に出て、× で外せる", () => {
    renderOpen(
      <CommentSection
        postId="p1"
        canComment
        returnTo="/posts/p1"
        initialPage={{ comments: [comment("c1", true)], nextOffset: null, totalCount: 1 }}
        api={api()}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "返信" })[0]);
    const form = document.querySelector("[data-comment-form]") as HTMLElement;
    expect(form.querySelector("[data-reply-to]")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返信をやめる" }));
    expect(document.querySelector("[data-reply-to]")).toBeNull();
  });

  it("#803: 送るボタンは丸い記号のボタン（読み上げには「コメントする」）", () => {
    show();
    const submit = screen.getByRole("button", { name: "コメントする" });
    expect(submit.className).toContain("rounded-full");
    expect(submit.querySelector("svg")).toBeInTheDocument();
  });
});
