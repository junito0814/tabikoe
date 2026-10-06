"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { HIDDEN_TAB_LABELS, HIDDEN_TABS, type HiddenItem, type HiddenKind, type HiddenTab } from "@/lib/admin/hidden-items";
import { relativeTime } from "./AdminDashboardScreen";

export interface HiddenPage {
  items: HiddenItem[];
  nextOffset: number | null;
}
export type FetchHidden = (tab: HiddenTab, offset: number) => Promise<HiddenPage>;
export type RestoreHidden = (kind: HiddenKind, id: string, note: string) => Promise<Response>;

/**
 * user-management Task 3: 非公開にしたもの（SC-25）
 * 出典: docs/tasks/admin/user-management/03-hidden-items.md
 *       docs/wireframes.md「SC-25 非公開のもの」
 *
 * 【初心者向け】3 タブ（自動／管理者／停止）。タブは URL（?tab=）に持ち、ダッシュボードの「確認→」は自動のタブで開く。
 * 復元は理由が必須で、確認ダイアログを挟む。自動非公開の復元＝「問題なし・元に戻す」（通報も問題なしになる）。
 */
export function HiddenItemsScreen({
  tab,
  counts,
  initialPage,
  fetchHidden = defaultFetch,
  restore = defaultRestore,
}: {
  tab: HiddenTab;
  /** タブに出す件数（auto だけ必須。他は取れれば） */
  counts: Partial<Record<HiddenTab, number>>;
  initialPage: HiddenPage;
  fetchHidden?: FetchHidden;
  restore?: RestoreHidden;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialPage.items);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<HiddenItem | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadMore = async () => {
    if (nextOffset === null) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const page = await fetchHidden(tab, nextOffset);
      setItems((current) => [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoading(false);
    }
  };

  const runRestore = async () => {
    if (!confirming || isSubmitting) return;
    if (!note.trim()) {
      setErrorMessage("理由を入力してください");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await restore(confirming.kind, confirming.id, note.trim());
      if (!response.ok) {
        setErrorMessage("復元できませんでした");
        return;
      }
      setItems((current) => current.filter((i) => !(i.kind === confirming.kind && i.id === confirming.id)));
      setResult(`${confirming.label}を復元しました`);
      setConfirming(null);
      setNote("");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("復元できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div role="tablist" className="flex flex-wrap gap-1 text-[0.75rem]">
        {HIDDEN_TABS.map((key) => (
          <Link
            key={key}
            role="tab"
            aria-selected={tab === key}
            href={`/admin/hidden?tab=${key}`}
            className={`flex h-9 items-center gap-1 rounded-full px-3 font-medium ${tab === key ? "bg-tint text-accent" : "text-muted hover:text-ink"}`}
          >
            {HIDDEN_TAB_LABELS[key]}
            {counts[key] !== undefined && (
              <span className={`rounded-full px-1.5 text-[0.625rem] ${key === "auto" && (counts[key] ?? 0) > 0 ? "bg-accent text-white" : "border border-line"}`}>{counts[key]}</span>
            )}
          </Link>
        ))}
      </div>

      {errorMessage && <ErrorNotice message={errorMessage} />}
      {result && (
        <p role="status" className="text-[0.75rem] text-done">
          {result}
        </p>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-[0.75rem] text-ink">
          <thead className="border-b border-line text-[0.6875rem] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">非公開になった</th>
              <th className="px-3 py-2 font-medium">対象</th>
              <th className="px-3 py-2 font-medium">理由</th>
              <th className="px-3 py-2 font-medium">投稿者</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  ありません
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={`${item.kind}:${item.id}`} className="border-b border-line last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2 text-muted">{relativeTime(item.hiddenAt)}</td>
                <td className="px-3 py-2 font-semibold">
                  {item.label}
                  {item.href && (
                    <a href={item.href} target="_blank" rel="noreferrer" className="ml-2 font-normal text-accent underline underline-offset-2">
                      見る ↗
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{item.reason ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {item.authorId ? (
                    <Link href={`/admin/users/${item.authorId}`} className="underline underline-offset-2">
                      {item.authorName ?? "（名前なし）"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {item.reportId && (
                    <Link href={`/admin/reports/${item.reportId}`} className="mr-3 text-accent underline underline-offset-2">
                      通報を見る
                    </Link>
                  )}
                  <button type="button" onClick={() => setConfirming(item)} className="h-8 rounded-[8px] border border-line px-3 font-medium text-ink">
                    {tab === "auto" ? "問題なし・元に戻す" : "復元"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextOffset !== null && (
        <button type="button" onClick={() => void loadMore()} disabled={isLoading} className="h-10 rounded-[8px] border border-line bg-surface text-[0.8125rem] font-medium text-ink disabled:opacity-45">
          {isLoading ? "読み込み中..." : "もっと見る"}
        </button>
      )}

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="restore-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
            <h2 id="restore-dialog-title" className="mb-2 text-[1rem] font-bold text-ink">
              {confirming.label}を復元しますか
            </h2>
            <p className="mb-3 text-[0.75rem] leading-[1.7] text-muted">
              {tab === "auto" ? "公開に戻し、この対象への未処理の通報を「問題なし」にします。" : "公開に戻します。"}操作の記録に残ります。
            </p>
            <label className="block text-[0.6875rem] text-muted">
              理由（必須）
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-0.5 block w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-[0.75rem] text-ink" />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirming(null)} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] border border-line text-[0.875rem] font-medium text-ink">
                キャンセル
              </button>
              <button type="button" onClick={() => void runRestore()} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] bg-ink text-[0.875rem] font-semibold text-on-ink disabled:opacity-45">
                {isSubmitting ? "復元中…" : "復元する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function defaultFetch(tab: HiddenTab, offset: number): Promise<HiddenPage> {
  const response = await fetchWithAuthRedirect(`/api/admin/hidden?tab=${tab}&offset=${offset}`);
  if (!response.ok) throw new Error("fetch_failed");
  return (await response.json()) as HiddenPage;
}

function defaultRestore(kind: HiddenKind, id: string, note: string): Promise<Response> {
  return fetchWithAuthRedirect("/api/admin/hidden/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, note }) });
}
