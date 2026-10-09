import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { existsSync, globSync, readFileSync } from "node:fs";
import ConsentRenewLoading from "./consent/renew/loading";
import AccountLoading from "./account/loading";
import SignupLoading from "./signup/loading";
import PostsNewLoading from "./posts/new/loading";
import BadgesLoading from "./badges/loading";
import InvitationLoading from "./invitations/[token]/loading";
import ItineraryInvitationLoading from "./itinerary-invitations/[token]/loading";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md 単体テスト
 * 要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】`loading.tsx` は Next.js が画面遷移の直後に自動で出す受け皿。
 * 2026-09-22 に 10 ルートへ入れたが、そこで線を引いた「主要な動線」から
 * **必ず通る画面が漏れていた**（規約の再同意は全員、新規登録は新しい人が必ず通る）。
 * 見た目そのものは機械で測れないので、ここで見るのは 2 つ。
 *   1. 「読み込んでいます」と伝わる形（`role="status"`）になっているか
 *   2. 既存の骨組みの部品を使っているか（同じ形の写しを作っていないか。約束 14）
 */
const ADDED: [string, () => React.ReactElement, string][] = [
  ["/consent/renew", ConsentRenewLoading, "src/app/consent/renew/loading.tsx"],
  ["/account", AccountLoading, "src/app/account/loading.tsx"],
  ["/signup", SignupLoading, "src/app/signup/loading.tsx"],
  ["/posts/new", PostsNewLoading, "src/app/posts/new/loading.tsx"],
  ["/badges", BadgesLoading, "src/app/badges/loading.tsx"],
  ["/invitations/[token]", InvitationLoading, "src/app/invitations/[token]/loading.tsx"],
  ["/itinerary-invitations/[token]", ItineraryInvitationLoading, "src/app/itinerary-invitations/[token]/loading.tsx"],
];

describe("Task 5: 足した受け皿", () => {
  it("7 枚ある（#684 でアカウントの状態を廃止したぶん 1 枚減った）", () => {
    expect(ADDED).toHaveLength(7);
  });

  it.each(ADDED)("%s は「読み込んでいます」と伝わる形を描く", (_route, Loading) => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "読み込んでいます");
  });

  it.each(ADDED)("%s は Skeletons.tsx の部品を使っている（形の写しを作っていない）", (_route, _Loading, path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain('from "@/components/skeleton/Skeletons"');
    // 自前でタグを並べていないこと（部品を組み合わせるだけにする）
    expect(source).not.toMatch(/className="[^"]*animate-pulse/);
  });

  /*
   * #900（2026-10-09）: ~~ホーム・地図・あしあと・通報には置かない~~ → **置くことにした。**
   *
   * 【初心者向け】「待ちがほぼ無い」という前提が間違っていた。本番で測ると、冷えた関数が
   * 立ち上がるのに **2.44 秒**かかっていた（温まっていれば 0.21 秒）。その間ずっと前の画面のままで、
   * 利用者には「押しても何も起きない」と見えていた。
   *
   * ただし「ちらつく」という元の指摘は正しかったので、**遅れて出す**ようにした（`DelayedSkeleton`）。
   * 残るのは「他の画面へ送るだけ」の画面だけ ── 骨組みを出す意味が無いので置かない。
   */
  it("他の画面へ送るだけの画面には置かない", () => {
    const notPlaced = [["src/app/spots/[id]/photos", "スポットの写真一覧（redirect するだけ）"]];
    for (const [dir, label] of notPlaced) {
      // ディレクトリ自体はあること（パスの打ち間違いでこのテストが空振りしないように）
      expect(existsSync(dir), `${label} のディレクトリ（${dir}）が無い`).toBe(true);
      expect(existsSync(`${dir}/loading.tsx`), `${label} に loading.tsx が置かれている`).toBe(false);
    }
  });

  it("#900 で足した画面に置いてある", () => {
    const placed = [
      ["src/app", "ホーム（SC-00）"],
      ["src/app/map", "地図（SC-02）"],
      ["src/app/mymap", "あしあと"],
      ["src/app/report", "通報"],
      ["src/app/login", "ログイン"],
      ["src/app/terms", "利用規約"],
      ["src/app/privacy", "個人情報保護方針"],
      ["src/app/users/[id]", "他の人のプロフィール"],
      ["src/app/mypage/drafts", "下書き"],
      ["src/app/albums/[id]/photos", "アルバムの写真一覧"],
      ["src/app/posts/[id]/edit", "投稿の編集"],
      ["src/app/spots/[id]/edit", "スポットの修正"],
    ];
    for (const [dir, label] of placed) {
      expect(existsSync(`${dir}/loading.tsx`), `${label}（${dir}）に loading.tsx が無い`).toBe(true);
    }
  });

  it("#900 で足した受け皿は、速いときに出ないよう遅らせてある", () => {
    for (const path of globSync("src/app/**/loading.tsx")) {
      const source = readFileSync(path, "utf8");
      if (!source.includes("#900")) continue; // 既存の 17 枚は対象外
      expect(source, `${path} が DelayedSkeleton で包まれていない`).toContain("<DelayedSkeleton>");
    }
    // 動きの定義が消えていないこと
    expect(readFileSync("src/app/globals.css", "utf8")).toContain(".skeleton-delayed");
  });

  it("管理画面には置いていない（2026-09-30 に保留。要件 9 章 No.14）", () => {
    expect(existsSync("src/app/admin"), "管理画面のディレクトリが無い").toBe(true);
    expect(existsSync("src/app/admin/loading.tsx")).toBe(false);
    expect(existsSync("src/app/admin/(shell)/loading.tsx")).toBe(false);
  });

  it("受け皿は全部で 29 枚（既存 17 ＋ #900 の 12）", () => {
    // 数を書いておくと、うっかり増やした・消したときに気づける
    const all = globSync("src/app/**/loading.tsx");
    expect(all.sort()).toHaveLength(29);
  });
});
