"use client";

import { useState, type FormEvent } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { ADMIN_ACTION_LABELS, ADMIN_ACTION_TYPES, type AdminActionItem, type AdminActionType } from "@/lib/admin/admin-actions";

export interface AdminActionsPage {
  actions: AdminActionItem[];
  nextOffset: number | null;
}
export type FetchAdminActions = (params: URLSearchParams) => Promise<AdminActionsPage>;

interface FilterState {
  actor: string;
  action: AdminActionType | "";
  from: string;
  to: string;
}
const EMPTY: FilterState = { actor: "", action: "", from: "", to: "" };

/** 絞り込み → クエリ（純粋関数。単体テスト用に export） */
export function buildAdminActionParams(state: FilterState, offset: number): URLSearchParams {
  const params = new URLSearchParams();
  if (state.actor) params.set("actor", state.actor);
  if (state.action) params.set("action", state.action);
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (offset > 0) params.set("offset", String(offset));
  return params;
}

/**
 * user-management Task 4: 操作の記録（SC-27）
 * 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
 *       docs/wireframes.md「SC-27 操作の記録」
 *
 * 【初心者向け】通報一覧（ReportListScreen）と同じ作り。`draft`（入力中）と `applied`（検索に使った条件）を分け、
 * 「表示」で draft → applied にして 1 ページ目から取り直し、「もっと見る」は applied で続きを取る。
 * 自動処理の行は「誰が」が「自動」になる。この画面から消す・直す操作は無い（記録は消せない）。
 */
export function AdminActionsScreen({
  initialPage,
  admins,
  fetchActions = defaultFetch,
}: {
  initialPage: AdminActionsPage;
  /** 「管理者」の絞り込みに出す候補 */
  admins: { id: string; name: string }[];
  fetchActions?: FetchAdminActions;
}) {
  const [draft, setDraft] = useState<FilterState>(EMPTY);
  const [applied, setApplied] = useState<FilterState>(EMPTY);
  const [actions, setActions] = useState(initialPage.actions);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async (state: FilterState, offset: number, replace: boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchActions(buildAdminActionParams(state, offset));
      setActions((current) => (replace ? page.actions : [...current, ...page.actions]));
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

  const selectClass = "h-9 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink";

  return (
    <div className="flex w-full flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-line bg-surface p-3">
        <label className="text-[11px] text-muted">
          管理者
          <select className={`${selectClass} block`} value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })}>
            <option value="">すべて</option>
            <option value="auto">自動</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-muted">
          操作
          <select
            className={`${selectClass} block`}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value as FilterState["action"] })}
          >
            <option value="">すべて</option>
            {ADMIN_ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {ADMIN_ACTION_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-muted">
          期間（から）
          <input type="date" className={`${selectClass} block`} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label className="text-[11px] text-muted">
          期間（まで）
          <input type="date" className={`${selectClass} block`} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </label>
        <button type="submit" disabled={isLoading} className="h-9 rounded-[8px] bg-ink px-4 text-[12px] font-semibold text-on-ink disabled:opacity-45">
          表示
        </button>
      </form>

      {errorMessage && <ErrorNotice message={errorMessage} />}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-[12px] text-ink">
          <thead className="border-b border-line text-[11px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">日時</th>
              <th className="px-3 py-2 font-medium">誰が</th>
              <th className="px-3 py-2 font-medium">操作</th>
              <th className="px-3 py-2 font-medium">対象</th>
              <th className="px-3 py-2 font-medium">理由</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  記録はまだありません
                </td>
              </tr>
            )}
            {actions.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{formatDateTime(item.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {/* #585: actor_id が NULL でも、退会した管理者の行は「自動」と区別する */}
                  {item.isAutomatic ? <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted">自動</span> : item.actorName}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{ADMIN_ACTION_LABELS[item.action]}</td>
                <td className="px-3 py-2">{item.targetLabel ?? "—"}</td>
                <td className="px-3 py-2 text-muted">{item.note ?? "—"}</td>
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
          className="h-10 rounded-[8px] border border-line bg-surface text-[13px] font-medium text-ink disabled:opacity-45"
        >
          {isLoading ? "読み込み中..." : "もっと見る"}
        </button>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function defaultFetch(params: URLSearchParams): Promise<AdminActionsPage> {
  const response = await fetchWithAuthRedirect(`/api/admin/actions?${params.toString()}`);
  if (!response.ok) throw new Error("fetch_failed");
  return (await response.json()) as AdminActionsPage;
}
