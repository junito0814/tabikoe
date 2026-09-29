import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StepUpCancelledError, useStepUp } from "./use-step-up";

/** 出典: docs/tasks/admin/admin-login/07-step-up-reauth.md 単体テスト（409 → 小窓 → 同じ操作を送り直す） */
vi.mock("@/lib/api/fetch-with-auth-redirect", () => ({
  UnauthorizedError: class extends Error {},
  fetchWithAuthRedirect: async () => Response.json({ ok: true }),
}));

const stepUpRequired = () => Response.json({ error: "step_up_required" }, { status: 409 });

/** フックを試すための小さな画面 */
function Harness({ submit, onResult }: { submit: (note: string) => Promise<Response>; onResult: (text: string) => void }) {
  const { submit: guarded, dialog } = useStepUp(submit);
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          try {
            const response = await guarded("電話番号を含むため");
            onResult(response.ok ? "成功" : "失敗");
          } catch (error) {
            onResult(error instanceof StepUpCancelledError ? "やめた" : "例外");
          }
        }}
      >
        削除する
      </button>
      {dialog}
    </div>
  );
}

describe("useStepUp", () => {
  it("409 が返ったら小窓を出し、6 桁が通ったら同じ引数で送り直す", async () => {
    const submit = vi.fn().mockResolvedValueOnce(stepUpRequired()).mockResolvedValueOnce(Response.json({ ok: true }));
    const onResult = vi.fn();
    render(<Harness submit={submit} onResult={onResult} />);

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // まだ 1 回しか送っていない（結果も出していない）
    expect(submit).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("認証アプリの 6 桁"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "確認して続ける" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    // 2 回目も同じ引数（書いた理由メモがそのまま渡る）
    expect(submit).toHaveBeenNthCalledWith(2, "電話番号を含むため");
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("成功"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("やめたら送り直さず、専用のエラーで抜ける（画面はエラー文を出さない）", async () => {
    const submit = vi.fn(async () => stepUpRequired());
    const onResult = vi.fn();
    render(<Harness submit={submit} onResult={onResult} />);

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith("やめた"));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("409 でも step_up_required でなければ小窓を出さず、そのまま返す", async () => {
    const submit = vi.fn(async () => Response.json({ error: "not_provisional" }, { status: 409 }));
    const onResult = vi.fn();
    render(<Harness submit={submit} onResult={onResult} />);
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("失敗"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("6 桁が要らないときは素通し（小窓を出さない）", async () => {
    const submit = vi.fn(async () => Response.json({ ok: true }));
    const onResult = vi.fn();
    render(<Harness submit={submit} onResult={onResult} />);
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("成功"));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
