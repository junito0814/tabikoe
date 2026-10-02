import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { existsSync, globSync, readFileSync } from "node:fs";
import ConsentRenewLoading from "./consent/renew/loading";
import AccountStatusLoading from "./account/status/loading";
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
  ["/account/status", AccountStatusLoading, "src/app/account/status/loading.tsx"],
  ["/account", AccountLoading, "src/app/account/loading.tsx"],
  ["/signup", SignupLoading, "src/app/signup/loading.tsx"],
  ["/posts/new", PostsNewLoading, "src/app/posts/new/loading.tsx"],
  ["/badges", BadgesLoading, "src/app/badges/loading.tsx"],
  ["/invitations/[token]", InvitationLoading, "src/app/invitations/[token]/loading.tsx"],
  ["/itinerary-invitations/[token]", ItineraryInvitationLoading, "src/app/itinerary-invitations/[token]/loading.tsx"],
];

describe("Task 5: 足した 8 枚の受け皿", () => {
  it("8 枚ある（要件 4.5.11 の表で「置く」としたぶん）", () => {
    expect(ADDED).toHaveLength(8);
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

  it("要件 4.5.11 の表で「置かない」とした画面には置いていない", () => {
    // ホーム・地図・あしあと・通報・スポットの写真一覧は待ちがほぼ無く、置くと一瞬ちらつく。
    // ディレクトリは実在するので「その中に loading.tsx が無い」ことが確かめられる
    const notPlaced = [
      ["src/app", "ホーム（SC-00）"],
      ["src/app/map", "地図（SC-02）"],
      ["src/app/mymap", "あしあと"],
      ["src/app/report", "通報"],
      ["src/app/spots/[id]/photos", "スポットの写真一覧"],
    ];
    for (const [dir, label] of notPlaced) {
      // ディレクトリ自体はあること（パスの打ち間違いでこのテストが空振りしないように）
      expect(existsSync(dir), `${label} のディレクトリ（${dir}）が無い`).toBe(true);
      expect(existsSync(`${dir}/loading.tsx`), `${label} に loading.tsx が置かれている`).toBe(false);
    }
  });

  it("管理画面には置いていない（2026-09-30 に保留。要件 9 章 No.14）", () => {
    expect(existsSync("src/app/admin"), "管理画面のディレクトリが無い").toBe(true);
    expect(existsSync("src/app/admin/loading.tsx")).toBe(false);
    expect(existsSync("src/app/admin/(shell)/loading.tsx")).toBe(false);
  });

  it("受け皿は全部で 18 枚（既存 10 ＋ 今回の 8）", () => {
    // 数を書いておくと、うっかり増やした・消したときに気づける
    const all = globSync("src/app/**/loading.tsx");
    expect(all.sort()).toHaveLength(18);
  });
});
