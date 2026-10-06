import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MoreMenu, MoreMenuItem } from "./MoreMenu";

/** 出典: Issue #770「「通報する」を右上の「⋯」へ移す」 */
describe("MoreMenu（#770）", () => {
  const sample = (onClick = vi.fn()) => (
    <MoreMenu>
      <MoreMenuItem label="アルバム" href="/albums/t1" />
      <MoreMenuItem label="メンバー" onClick={onClick} />
      <MoreMenuItem label="削除" danger onClick={vi.fn()} />
    </MoreMenu>
  );

  it("押すまで開かない。押すと中身が出る", () => {
    render(sample());
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["アルバム", "メンバー", "削除"]);
  });

  it("行き先があるものはリンク、その場で何かするものはボタン", () => {
    render(sample());
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "アルバム" })).toHaveAttribute("href", "/albums/t1");
    expect(screen.getByRole("menuitem", { name: "メンバー" }).tagName).toBe("BUTTON");
  });

  it("選ぶと閉じる", () => {
    const onClick = vi.fn();
    render(sample(onClick));
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "メンバー" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("外をタップすると閉じる（use-outside-close と同じ作法）", () => {
    render(sample());
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("取り返しのつかないものは赤", () => {
    render(sample());
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("menuitem", { name: "削除" }).className).toContain("text-saved");
  });

  it("名前を変えられる（しおりの行は「〈スポット名〉のその他」）。処理中は開かせない", () => {
    render(
      <MoreMenu label="浅草寺 のその他" disabled>
        <MoreMenuItem label="外す" onClick={vi.fn()} />
      </MoreMenu>
    );
    expect(screen.getByRole("button", { name: "浅草寺 のその他" })).toBeDisabled();
  });

  it("指で押せる大きさ（32px 以上。#784）", () => {
    render(sample());
    expect(screen.getByRole("button", { name: "その他" }).className).toContain("h-8");
  });
});

/**
 * 【初心者向け】写しを作らせないための見張り。「⋯」の作りが何か所にも書かれると、
 * 片方だけ直してズレる（約束 14）。
 */
describe("「⋯」は全部この部品から出す（#770）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");
  walk("src/app");

  it("自前で `aria-haspopup=\"menu\"` の「⋯」を作っているファイルが無い", () => {
    const offenders = files.filter(
      (path) => path !== "src/components/ui/MoreMenu.tsx" && /aria-haspopup="menu"/.test(readFileSync(path, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("「⋯」を置く画面はこの部品を使う", () => {
    for (const path of [
      "src/components/albums/AlbumScreen.tsx",
      "src/components/itineraries/ItineraryDetailScreen.tsx",
      "src/components/itineraries/ItinerarySpotRow.tsx",
      "src/components/posts/PostDetailScreen.tsx",
      "src/components/posts/SpotPostListScreen.tsx",
    ]) {
      expect(readFileSync(path, "utf8"), `${path} が MoreMenu を使っていない`).toContain("<MoreMenu");
    }
  });
});
