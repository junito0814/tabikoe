"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * F-SF-02 Task3: ブロック実行導線（確認ダイアログ付き）
 * 出典: docs/tasks/safety/blocking/03-block-management-ui.md
 *
 * 他ユーザーのプロフィール（/users/[id]）等に置く。自分自身には表示しないこと（呼び出し側の責務）。
 * 実行後はブロック相手のプロフィールが見えなくなる（3.8.2）ため、トップページへ戻す。
 */
export function BlockUserButton({
  targetUserId,
  targetDisplayName,
  submitBlock = defaultSubmitBlock,
}: {
  targetUserId: string;
  targetDisplayName: string;
  /** 差し替え口（単体テスト用） */
  submitBlock?: (targetUserId: string) => Promise<Response>;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBlock = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await submitBlock(targetUserId);

      if (response.status === 409) {
        // 既にブロック済み。目的は達しているので成功扱いで遷移する
        router.push("/map?blocked=1");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setErrorMessage("ブロックできませんでした。もう一度お試しください");
        setIsSubmitting(false);
        return;
      }

      router.push("/map?blocked=1");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("ブロックできませんでした。もう一度お試しください");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="tap-target text-[13px] font-medium text-muted underline underline-offset-2"
      >
        このユーザーをブロック
      </button>

      {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
            <h2 className="mb-3 text-[16px] font-bold text-ink">
              {targetDisplayName} をブロックしますか
            </h2>
            <ul className="mb-4 list-disc space-y-1.5 pl-4 text-[13px] leading-[1.6] text-ink">
              <li>お互いの投稿・コメント・プロフィール・アルバムが表示されなくなります</li>
              <li>同じアルバムのメンバー同士の場合、アルバム内では相手の投稿が表示されます</li>
              <li>ブロックはいつでも解除できます（アカウント画面から）</li>
            </ul>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleBlock}
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSubmitting ? "処理中..." : "ブロックする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultSubmitBlock(targetUserId: string): Promise<Response> {
  return fetchWithAuthRedirect("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockedId: targetUserId }),
  });
}
