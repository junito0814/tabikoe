"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * F-PO-03 Task4: 投稿削除ボタン・確認ダイアログ
 * 出典: docs/tasks/posts/post-delete/04-post-delete-ui.md
 *
 * 投稿者本人にのみ表示する。呼び出し側（SC-03編集モード）が本人確認済みの画面でのみ
 * 描画するため、このコンポーネント自体は権限判定を持たない。
 * 投稿詳細画面（SC-05）への設置は、その画面がPhase 6で未実装のため対象外。
 */
export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithAuthRedirect(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setErrorMessage("投稿を削除できませんでした");
        setIsDeleting(false);
        return;
      }

      router.push("/?deleted=1");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("投稿を削除できませんでした");
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-[13px] font-medium text-[#C4703F] underline underline-offset-2"
      >
        この投稿を削除
      </button>

      {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-[16px] font-bold text-[#3D3A35]">投稿を削除しますか</h2>
            <p className="mb-4 text-[13px] leading-[1.7] text-[#3D3A35]">
              この投稿に付いた写真・コメント・いいねも同時に削除されます。元に戻すことはできません。
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isDeleting}
                className="h-11 flex-1 rounded-[10px] border border-[#E8E1D8] text-[14px] font-medium text-[#3D3A35]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-11 flex-1 rounded-[10px] bg-[#C4703F] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
