import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AccountScreen } from "./AccountScreen";

/**
 * 出典: Issue #799「文字リンクを操作に使わない決まりを足し、アカウント画面を行の形にする」
 *       Issue #783「Bug 3: 「アカウント」に戻るが無い。見出しの重複、効かない「保存」」
 *       要件定義書 4.5.16
 */
const show = (isAdmin = false, likedPostCount = 0) =>
  render(
    <AccountScreen
      displayName="たろう"
      blockedCount={0}
      likedPostCount={likedPostCount}
      isAdmin={isAdmin}
      profileForm={<p>名前と画像の編集</p>}
      blockedList={<p>いません</p>}
      logoutButton={<button type="button">ログアウト</button>}
      deleteDialog={<button type="button">退会する</button>}
    />
  );

describe("アカウント画面（#799・#783）", () => {
  it("#783: 左上に「‹ マイページ」がある（要件 4.5.13）", () => {
    show();
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
  });

  it("#799: 行の形。名前と画像・ブロック・規約・ログアウト・退会がそろう", () => {
    show();
    expect(screen.getByRole("button", { name: /名前と画像/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ブロック中のユーザー/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms?back=%2Faccount");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy?back=%2Faccount");
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退会する" })).toBeInTheDocument();
  });

  it("行には今の値が出る（名前・ブロックの人数）", () => {
    show();
    expect(screen.getByRole("button", { name: /名前と画像/ }).textContent).toContain("たろう");
    expect(screen.getByRole("button", { name: /ブロック中のユーザー/ }).textContent).toContain("0 人");
  });

  it("名前と画像の行を押すとシートが開く", () => {
    show();
    expect(screen.queryByText("名前と画像の編集")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /名前と画像/ }));
    expect(screen.getByText("名前と画像の編集")).toBeInTheDocument();
  });

  it("管理者にだけ管理画面への行が出る", () => {
    const { unmount } = show(false);
    expect(screen.queryByRole("link", { name: "管理者ダッシュボード" })).toBeNull();
    unmount();
    show(true);
    expect(screen.getByRole("link", { name: "管理者ダッシュボード" })).toHaveAttribute("href", "/admin");
  });
});

/**
 * #799 の受入条件: アカウント画面に下線のリンクが無い。
 * 【初心者向け】下線は「別の画面・外部へ飛ぶ」ときだけ（要件 4.5.16）。
 * 操作に使うと、Web ページのような見た目になり押せる範囲も狭い。
 */
describe("アカウントまわりに下線の操作リンクが無い（#799）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) files.push(path);
    }
  };
  walk("src/app/account");
  walk("src/components/account");
  files.push("src/components/blocks/BlockedUsersList.tsx");

  it("underline を使っているファイルが無い", () => {
    const offenders = files.filter((path) => readFileSync(path, "utf8").includes("underline"));
    expect(offenders).toEqual([]);
  });
});

/**
 * #954（2026-10-17）: 「いいねした投稿」（SC-34）への入口
 * 出典: 要件定義書 3.6.6、ワイヤーフレーム決定事項 98
 */
describe("いいねした投稿への行（#954）", () => {
  it("1 つ目のグループの 3 行目に出て、押すと SC-34 へ行く", () => {
    show(false, 12);
    const row = screen.getByRole("link", { name: /いいねした投稿/ });
    expect(row).toHaveAttribute("href", "/likes");
    expect(row).toHaveTextContent("12 件");
    // 1 つ目のグループ（名前と画像・ブロック中のユーザー）の 3 行目
    const group = row.closest("ul") as HTMLElement;
    expect([...group.children].map((li) => li.textContent?.slice(0, 5))).toEqual(["名前と画像", "ブロック中", "いいねした"]);
  });

  it("文字の色はほかの行と同じ（色で目立たせない）", () => {
    show(false, 3);
    const label = screen.getByText("いいねした投稿");
    expect(label).toHaveClass("text-ink");
    expect(label).not.toHaveClass("text-saved");
  });
});
