/**
 * #892 / 決定事項 89（2026-10-11）: 通報一覧に「緊急度」と「Jev の見立て」を出す。
 *
 * 【初心者向け】ここで見張るのは**黙るべきときに黙れるか**です。
 *   Jev が落ちていても画面が壊れないこと、自信の無い見立てを出さないことを固めます。
 *   並べたデータは 2026-10-11 に実際に測った値です。
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportListScreen } from "./ReportListScreen";
import type { ReportListItem } from "@/lib/admin/report-filters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const base = {
  targetType: "post" as const,
  targetId: "p1",
  status: "unconfirmed" as const,
  resolvedAt: null,
  resolutionNote: null,
};

/** 2026-10-11 に実測した 4 件（緊急度・見立て・確信） */
const reports: ReportListItem[] = [
  { ...base, id: "r1", reason: "personal_info", detail: "本文に電話番号が書かれています", createdAt: "2026-10-10T00:00:00Z", jev: { urgency: 2.79, reason: "personal_info", confidence: 1 } },
  { ...base, id: "r2", reason: "other", detail: "写真に通りすがりの人の顔が写っています", createdAt: "2026-10-09T00:00:00Z", jev: { urgency: 2.23, reason: "copyright", confidence: 0.75 } },
  { ...base, id: "r3", reason: "inappropriate", detail: "まずかったと書いてあるのが気に入りません", createdAt: "2026-10-08T00:00:00Z", jev: { urgency: 0.28, reason: "other", confidence: 0.75 } },
  { ...base, id: "r4", reason: "spam", detail: "宣伝です", createdAt: "2026-10-07T00:00:00Z", jev: null },
];

function setup(items: ReportListItem[] = reports) {
  render(<ReportListScreen initialPage={{ reports: items, nextOffset: null }} fetchReports={vi.fn()} />);
}

const cells = (id: string) => Array.from(document.querySelector(`[data-report='${id}']`)!.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? "");

describe("緊急度", () => {
  it("小数 1 桁で出す", () => {
    setup();
    expect(cells("r1")[0]).toBe("2.8");
    expect(cells("r3")[0]).toBe("0.3");
  });

  it("**Jev が呼べなかった通報は「―」**（画面は壊れない）", () => {
    setup();
    expect(cells("r4")[0]).toBe("―");
  });

  it("重さで色を変える（赤・橙・灰）", () => {
    setup();
    const chip = (id: string) => document.querySelector(`[data-report='${id}'] td span`)!.className;
    expect(chip("r1")).toContain("bg-saved"); // 2.79 すぐ対応
    expect(chip("r2")).toContain("bg-star"); // 2.23 早めに
    expect(chip("r3")).toContain("bg-tint"); // 0.28 急がない
  });
});

describe("Jev の見立て", () => {
  it("食い違ったときは濃く出す ── ここがいちばん値打ちのあるところ", () => {
    setup();
    // 利用者は「その他」で送ったが、Jev は「著作権・肖像権の侵害」と見立て直した
    const cell = document.querySelectorAll("[data-report='r2'] td")[4];
    expect(cell.textContent).toContain("著作権・肖像権の侵害");
    expect(cell.querySelector("span")!.className).toContain("font-bold");
  });

  it("合っているときは薄く出す（ただの重複なので目立たせない）", () => {
    setup();
    const cell = document.querySelectorAll("[data-report='r1'] td")[4];
    expect(cell.textContent).toContain("個人情報の掲載");
    expect(cell.querySelector("span")!.className).toContain("text-muted");
  });

  it("**「その他」は出さない**（運営者が次にすることが何も変わらないため）", () => {
    setup();
    expect(cells("r3")[4]).toBe("―");
  });

  it("呼べなかった通報は「―」", () => {
    setup();
    expect(cells("r4")[4]).toBe("―");
  });
});

describe("古い通報を埋もれさせない", () => {
  it("いちばん古い未対応が何日前かを出し、古い順へ切り替えられる", () => {
    setup();
    expect(screen.getByText(/最も古い未対応は/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "古い順で見る" })).toBeTruthy();
  });

  it("対応済みのものは数えない", () => {
    setup([{ ...reports[0], status: "resolved_hidden", createdAt: "2020-01-01T00:00:00Z" }]);
    expect(screen.queryByText(/最も古い未対応は/)).toBeNull();
  });
});

describe("並び", () => {
  it("既定は緊急度が高い順", () => {
    setup();
    expect((screen.getByLabelText("並び") as HTMLSelectElement).value).toBe("urgency");
  });
});
