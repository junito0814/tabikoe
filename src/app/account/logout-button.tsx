"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * F-AC-03 Task2: プロフィール編集画面（SC-07）のログアウトUI
 * 出典: docs/tasks/account/logout/02-profile-screen-logout-ui.md
 */
export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      /* #799: 下線の文字リンクをやめ、行の中の文字に（要件 4.5.16） */
      className="w-full text-left text-[0.875rem] text-ink disabled:opacity-45"
    >
      {isLoading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
