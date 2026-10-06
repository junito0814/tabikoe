"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import {
  buildUserListParams,
  USER_SORT_LABELS,
  USER_SORTS,
  USER_STATUS_LABELS,
  type AdminUserRow,
  type UserListQuery,
  type UserSort,
  type UserStatus,
} from "@/lib/admin/users";
import { StrikeDots } from "./StrikeDots";
import { relativeTime } from "./AdminDashboardScreen";

export interface UserListPage {
  users: AdminUserRow[];
  nextOffset: number | null;
}
export type FetchUsers = (params: URLSearchParams) => Promise<UserListPage>;

/**
 * user-management Task 1: 利用者一覧（SC-24 一覧）
 * 出典: docs/tasks/admin/user-management/01-user-list.md
 *       docs/wireframes.md「SC-24 利用者一覧」
 *
 * 【初心者向け】通報一覧・操作の記録と同じ draft／applied の作り。行を押すと利用者詳細（Task 2）へ。
 */
export function UserListScreen({
  initialPage,
  initialQuery,
  fetchUsers = defaultFetch,
}: {
  initialPage: UserListPage;
  initialQuery: UserListQuery;
  fetchUsers?: FetchUsers;
}) {
  const [draft, setDraft] = useState<UserListQuery>(initialQuery);
  const [applied, setApplied] = useState<UserListQuery>(initialQuery);
  const [users, setUsers] = useState(initialPage.users);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async (query: UserListQuery, offset: number, replace: boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchUsers(buildUserListParams({ ...query, offset }));
      setUsers((current) => (replace ? page.users : [...current, ...page.users]));
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setApplied(draft);
    void load(draft, 0, true);
  };

  const field = "h-9 rounded-[8px] border border-line bg-surface px-2 text-[0.75rem] text-ink";

  return (
    <div className="flex w-full flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-line bg-surface p-3">
        <label className="text-[0.6875rem] text-muted">
          検索
          <input
            type="search"
            placeholder="表示名・メールで探す"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            className={`${field} block w-[220px]`}
          />
        </label>
        <label className="text-[0.6875rem] text-muted">
          状態
          <select value={draft.status ?? ""} onChange={(e) => setDraft({ ...draft, status: (e.target.value || null) as UserStatus | null })} className={`${field} block`}>
            <option value="">すべて</option>
            {(Object.keys(USER_STATUS_LABELS) as UserStatus[]).map((s) => (
              <option key={s} value={s}>
                {USER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.6875rem] text-muted">
          並び
          <select value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value as UserSort })} className={`${field} block`}>
            {USER_SORTS.map((s) => (
              <option key={s} value={s}>
                {USER_SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isLoading} className="h-9 rounded-[8px] bg-ink px-4 text-[0.75rem] font-semibold text-on-ink disabled:opacity-45">
          表示
        </button>
      </form>

      {errorMessage && <ErrorNotice message={errorMessage} />}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-[0.75rem] text-ink">
          <thead className="border-b border-line text-[0.6875rem] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">利用者</th>
              <th className="px-3 py-2 font-medium">登録日</th>
              <th className="px-3 py-2 font-medium">最終利用</th>
              <th className="px-3 py-2 text-right font-medium">投稿</th>
              <th className="px-3 py-2 text-right font-medium">通報された</th>
              <th className="px-3 py-2 font-medium">ストライク</th>
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  該当する利用者はいません
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-b-0" data-user={u.id}>
                <td className="px-3 py-2">
                  <span className="font-semibold">{u.displayName}</span>
                  <span className="block text-[0.6875rem] text-muted">{u.email}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{shortDate(u.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{u.lastActiveAt ? relativeTime(u.lastActiveAt) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u.postCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u.reportedCount}</td>
                <td className="px-3 py-2">
                  <StrikeDots active={u.activeStrikes} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <StatusChip status={u.status} until={u.postingRestrictedUntil} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-accent underline underline-offset-2">
                    開く
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextOffset !== null && (
        <button
          type="button"
          onClick={() => void load(applied, nextOffset, false)}
          disabled={isLoading}
          className="h-10 rounded-[8px] border border-line bg-surface text-[0.8125rem] font-medium text-ink disabled:opacity-45"
        >
          {isLoading ? "読み込み中..." : "もっと見る"}
        </button>
      )}
    </div>
  );
}

/** 状態のチップ。投稿禁止中は解除日を添える */
export function StatusChip({ status, until }: { status: UserStatus; until?: string | null }) {
  const tone =
    status === "normal" ? "border border-line text-muted" : status === "restricted" ? "bg-tint text-accent" : "bg-saved/10 text-saved";
  const label = status === "restricted" && until ? `投稿禁止（〜${shortDate(until)}）` : USER_STATUS_LABELS[status];
  return <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${tone}`}>{label}</span>;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function defaultFetch(params: URLSearchParams): Promise<UserListPage> {
  const response = await fetchWithAuthRedirect(`/api/admin/users?${params.toString()}`);
  if (!response.ok) throw new Error("fetch_failed");
  return (await response.json()) as UserListPage;
}
