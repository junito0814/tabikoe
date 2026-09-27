import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminShell } from "./AdminShell";

/** 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md 単体テスト */
let pathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  pathname = "/admin";
});

describe("AdminShell", () => {
  it("パソコンの左メニューに 7 項目が出て、今のページが選択中になる", () => {
    pathname = "/admin/reports/abc";
    render(
      <AdminShell adminName="たろう" badges={{ reports: 0, hidden: 0 }}>
        <p>本体</p>
      </AdminShell>
    );
    const side = screen.getByRole("navigation", { name: "管理メニュー" });
    expect(within(side).getAllByRole("link")).toHaveLength(8); // 7 項目＋サイトへ戻る
    expect(within(side).getByRole("link", { name: /通報一覧・対応/ })).toHaveAttribute("aria-current", "page");
    expect(within(side).getByRole("link", { name: /ダッシュボード/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("通報の詳細");
    expect(screen.getByText("本体")).toBeInTheDocument();
  });

  it("通報の未対応件数がメニューに出て、0 のときは出ない", () => {
    render(
      <AdminShell adminName="たろう" badges={{ reports: 3, hidden: 0 }}>
        <p />
      </AdminShell>
    );
    const side = screen.getByRole("navigation", { name: "管理メニュー" });
    expect(within(side).getByLabelText("3件")).toBeInTheDocument();
    expect(within(side).queryByLabelText("0件")).not.toBeInTheDocument();
  });

  it("スマホの下のバーは 4 項目＋その他で、その他は非公開の件数を持つ", () => {
    pathname = "/admin/legal";
    render(
      <AdminShell adminName="たろう" badges={{ reports: 0, hidden: 2 }}>
        <p />
      </AdminShell>
    );
    const bottom = screen.getByRole("navigation", { name: "管理メニュー（スマホ）" });
    const links = within(bottom).getAllByRole("link");
    expect(links).toHaveLength(5);
    const more = within(bottom).getByRole("link", { name: /その他/ });
    expect(more).toHaveAttribute("href", "/admin/more");
    expect(more).toHaveAttribute("aria-current", "page"); // 規約管理はその他の中
    expect(within(more).getByLabelText("2件")).toBeInTheDocument();
  });

  it("上のバーに管理者名とログアウトが出る", () => {
    render(
      <AdminShell adminName="たろう" badges={{ reports: 0, hidden: 0 }}>
        <p />
      </AdminShell>
    );
    expect(screen.getByText("たろう")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });
});
