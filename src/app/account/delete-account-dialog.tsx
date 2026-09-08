"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAIN = "#C4703F";

/**
 * F-AC-05 Task4: 退会確認ダイアログUI
 * 出典: docs/tasks/account/account-deletion/04-deletion-confirmation-dialog-ui.md
 *
 * プロフィール編集画面（SC-07）である ../account/page.tsx から呼び出す。
 */
export default function DeleteAccountDialog({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = acknowledged && (!isAdmin || handoverConfirmed) && !isSubmitting;

  const closeDialog = () => {
    setOpen(false);
    setAcknowledged(false);
    setHandoverConfirmed(false);
    setErrorMessage(null);
  };

  const handleDeactivate = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/users/me/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminHandoverConfirmed: handoverConfirmed }),
      });

      if (!response.ok) {
        setErrorMessage("退会処理に失敗しました。もう一度お試しください");
        setIsSubmitting(false);
        return;
      }

      router.push("/login");
    } catch {
      setErrorMessage("退会処理に失敗しました。もう一度お試しください");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-medium text-[#C4703F] underline underline-offset-2"
      >
        退会する
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-[16px] font-bold text-[#3D3A35]">
              退会前にご確認ください
            </h2>
            <ul className="mb-4 list-disc space-y-1.5 pl-4 text-[13px] leading-[1.6] text-[#3D3A35]">
              <li>投稿・コメントは残りますが、ユーザー名は「退会済みユーザー」として匿名化されます</li>
              <li>オーナーを務めているアルバムがある場合、オーナー権限は自動的に他のメンバーへ移譲されます</li>
            </ul>

            <label className="mb-3 flex cursor-pointer items-start gap-2 text-[13px] text-[#3D3A35]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              上記の内容を理解しました
            </label>

            {isAdmin && (
              <label className="mb-3 flex cursor-pointer items-start gap-2 text-[13px] text-[#3D3A35]">
                <input
                  type="checkbox"
                  checked={handoverConfirmed}
                  onChange={(e) => setHandoverConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                他の管理者へis_adminフラグの引き継ぎを完了しました
              </label>
            )}

            {errorMessage && (
              <p className="mb-3 text-[12px] text-[#C4703F]">{errorMessage}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-[10px] border border-[#E8E1D8] text-[14px] font-medium text-[#3D3A35]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={!canSubmit}
                className="h-11 flex-1 rounded-[10px] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                style={{ backgroundColor: MAIN }}
              >
                {isSubmitting ? "処理中..." : "退会する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
