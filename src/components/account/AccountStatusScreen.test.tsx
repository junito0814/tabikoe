import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountStatusScreen } from "./AccountStatusScreen";

/** 出典: docs/tasks/safety/strike-system/05-account-status.md 単体テスト */
describe("AccountStatusScreen", () => {
  it("制限中は帯と解除日、丸の数、履歴の理由とリンクが出る", () => {
    render(
      <AccountStatusScreen
        status={{
          restrictedUntil: "2099-09-28T09:10:00Z",
          activeStrikes: 2,
          strikesToSuspend: 5,
          expiryDays: 90,
          nextMeasure: "7日間 投稿・コメント禁止",
          history: [
            { id: "a", createdAt: "2026-09-25T00:00:00Z", expiresAt: "2026-12-24T00:00:00Z", state: "active", summary: "感想「…」を非公開にしました", reasonLabel: "不適切な表現" },
            { id: "c", createdAt: "2026-06-02T00:00:00Z", expiresAt: "2026-08-31T00:00:00Z", state: "expired", summary: "感想を非公開にしました", reasonLabel: "不適切な表現" },
          ],
        }}
      />
    );
    expect(screen.getByRole("note")).toHaveTextContent("いま、投稿とコメントができません");
    expect(screen.getByLabelText("有効なストライク 2/5")).toBeInTheDocument();
    expect(screen.getByText(/次の記録で 7日間 投稿・コメント禁止/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "利用規約 第8条" })).toHaveLength(2);
    expect(screen.getByText(/90日経過のため失効/)).toBeInTheDocument();
  });

  it("制限が無ければその旨を出す", () => {
    render(<AccountStatusScreen status={{ restrictedUntil: null, activeStrikes: 0, strikesToSuspend: 5, expiryDays: 90, nextMeasure: "警告", history: [] }} />);
    expect(screen.getByText("いまは制限を受けていません")).toBeInTheDocument();
    expect(screen.getByText("記録はありません")).toBeInTheDocument();
  });
});
