"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";

export interface BlockedUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * F-SF-02 Task3: ブロック中のユーザー一覧と解除（SC-07に配置）
 * 出典: docs/tasks/safety/blocking/03-block-management-ui.md
 *
 * 要件定義書にブロック管理の画面IDは無いため、ユーザーストーリーの設計判断どおり
 * プロフィール編集画面（SC-07）内のセクションとして置く。
 * 初期一覧はサーバー側（Server Component）で取得して渡し、解除後の反映はここで行う。
 */
export function BlockedUsersList({
  initialBlockedUsers,
  submitUnblock = defaultSubmitUnblock,
}: {
  initialBlockedUsers: BlockedUser[];
  /** 差し替え口（単体テスト用） */
  submitUnblock?: (blockedId: string) => Promise<Response>;
}) {
  const [blockedUsers, setBlockedUsers] = useState(initialBlockedUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnblock = async (blockedId: string) => {
    if (pendingId) return;
    setPendingId(blockedId);
    setErrorMessage(null);

    try {
      const response = await submitUnblock(blockedId);
      // 404は「既に解除済み」なので、一覧から消す目的は達している
      if (!response.ok && response.status !== 404) {
        setErrorMessage("ブロックを解除できませんでした");
        return;
      }
      setBlockedUsers((current) => current.filter((user) => user.id !== blockedId));
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("ブロックを解除できませんでした");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="w-full max-w-[360px]">
      <h2 className="mb-2 text-[0.75rem] font-medium text-muted">ブロック中のユーザー</h2>

      {blockedUsers.length === 0 ? (
        <p className="text-[0.75rem] text-muted">ブロック中のユーザーはいません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blockedUsers.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2"
            >
              <span className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl ?? DEFAULT_AVATAR_URL}
                  alt={`${user.displayName}のアイコン画像`}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="text-[0.8125rem] text-ink">{user.displayName}</span>
              </span>
              <button
                type="button"
                onClick={() => handleUnblock(user.id)}
                disabled={pendingId !== null}
                className="text-[0.75rem] font-medium text-accent underline underline-offset-2 disabled:opacity-45"
              >
                {pendingId === user.id ? "解除中..." : "解除"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}
    </section>
  );
}

function defaultSubmitUnblock(blockedId: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/blocks/${blockedId}`, { method: "DELETE" });
}
