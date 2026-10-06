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
const show = (isAdmin = false) =>
  render(
    <AccountScreen
      displayName="たろう"
      blockedCount={0}
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
