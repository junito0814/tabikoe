"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * #862（2026-10-07）: 投稿を消す処理だけを切り出したもの
 * 出典: Issue #862「Bug 5: 投稿が削除できない（確認も出ない）」
 *
 * 【初心者向け】もとは `DeletePostButton` が「ボタン＋確認ダイアログ＋消す処理」を 1 つに持っていました。
 * その部品を「⋯」メニューの中に置いたため、**押した瞬間にメニューごと消えて確認が出ません**でした
 * （`MoreMenu` は内側のどこを押しても閉じます）。
 *
 * そこで「消す処理」だけをここに残し、**確認は画面の側**（メニューの外）で出すようにします。
 * 画面が変わっても消し方は 1 つで済みます（約束 13・14）。
 */
export function useDeletePost(postId: string) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deletePost = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuthRedirect(`/api/posts/${postId}`, { method: "DELETE" });
      if (!response.ok) {
        setErrorMessage("投稿を削除できませんでした");
        setIsDeleting(false);
        return;
      }
      router.push("/map?deleted=1");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("投稿を削除できませんでした");
      setIsDeleting(false);
    }
  };

  return { deletePost, isDeleting, errorMessage };
}
