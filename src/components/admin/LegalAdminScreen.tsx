"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { LEGAL_KIND_LABELS, LEGAL_KIND_PATHS, LEGAL_KINDS, type LegalDocument, type LegalKind } from "@/lib/legal/legal-documents";
import { MAX_LEGAL_SUMMARY_LENGTH, type LegalVersionRow } from "@/lib/legal/legal-admin";

export interface LegalAdminApi {
  saveDraft: (input: { kind: LegalKind; id: string | null; version: string; summary: string; body: string }) => Promise<Response>;
  publish: (id: string) => Promise<Response>;
}

/**
 * legal-documents Task 2: 規約管理（SC-26）
 * 出典: docs/tasks/admin/legal-documents/02-legal-admin-screen.md
 *       docs/wireframes.md「SC-26 規約管理」
 *
 * 【初心者向け】お知らせ管理と同じ形。種類（利用規約／個人情報保護方針）はタブ（URL ?kind=）で切り替え、
 * 左で下書きを編集（版・変更の要点・本文 Markdown）、右に版の一覧（下書き／公開中／過去、公開日、同意済み N／全 M 人）。
 * 「この版を公開する」は確認ダイアログ（公開すると全員に再同意画面が出る）。公開済みの版は直せない。
 */
export function LegalAdminScreen({
  kind,
  draft,
  versions,
  totalUsers,
  api = defaultApi,
}: {
  kind: LegalKind;
  /** 今の下書き（無ければ公開中の版を下敷きに新しい下書きを作る） */
  draft: LegalDocument | null;
  versions: LegalVersionRow[];
  totalUsers: number;
  api?: LegalAdminApi;
}) {
  const router = useRouter();
  const published = versions.find((v) => v.status === "published") ?? null;
  // id が空の draft は「公開中の本文を下敷きにした新しい下書き」（まだ保存していない）
  const [draftId, setDraftId] = useState<string | null>(draft?.id || null);
  const [version, setVersion] = useState(draft?.version ?? suggestNextVersion(published?.version ?? null));
  const [summary, setSummary] = useState(draft?.summary ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canSave = version.trim().length > 0 && body.trim().length > 0 && !isSubmitting;

  const save = async (): Promise<string | null> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await api.saveDraft({ kind, id: draftId, version: version.trim(), summary: summary.trim(), body: body.trim() });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(
          data.error === "version_not_newer"
            ? `版は公開中（${published?.version ?? "—"}）より大きい番号にしてください`
            : data.error === "version_exists"
              ? "その版は既にあります"
              : data.error === "invalid_version"
                ? "版は 1.1 のような数字で入れてください"
                : "下書きを保存できませんでした"
        );
        return null;
      }
      const data = (await response.json()) as { id: string };
      setDraftId(data.id);
      return data.id;
    } catch (error) {
      if (error instanceof UnauthorizedError) return null;
      setErrorMessage("下書きを保存できませんでした");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const id = await save();
    if (id) {
      setResult("下書きを保存しました");
      router.refresh();
    }
  };

  const handlePublish = async () => {
    setConfirming(false);
    const id = await save();
    if (!id) return;
    setIsSubmitting(true);
    try {
      const response = await api.publish(id);
      if (!response.ok) {
        setErrorMessage("公開できませんでした");
        return;
      }
      setResult(`版 ${version.trim()} を公開しました。全員に再同意画面が出ます`);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("公開できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = "mt-0.5 block w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink";

  return (
    <div className="flex w-full flex-col gap-4">
      <div role="tablist" className="flex gap-1 text-[12px]">
        {LEGAL_KINDS.map((k) => (
          <Link key={k} role="tab" aria-selected={kind === k} href={`/admin/legal?kind=${k}`} className={`flex h-9 items-center rounded-full px-3 font-medium ${kind === k ? "bg-tint text-accent" : "text-muted hover:text-ink"}`}>
            {LEGAL_KIND_LABELS[k]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSave} className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4">
          <h2 className="text-[13px] font-bold text-ink">
            {LEGAL_KIND_LABELS[kind]} を編集{draftId ? "（下書き）" : "（新しい下書き）"}
          </h2>
          <label className="text-[12px] font-medium text-muted">
            版
            <input value={version} onChange={(e) => setVersion(e.target.value)} className={`${field} w-[160px]`} placeholder="1.1" />
            <span className="ml-2 text-[11px]">公開中: {published?.version ?? "なし"}</span>
          </label>
          <label className="text-[12px] font-medium text-muted">
            変更の要点（利用者に見せる 1〜3 行）
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={MAX_LEGAL_SUMMARY_LENGTH * 2} className={field} />
          </label>
          <label className="text-[12px] font-medium text-muted">
            本文（Markdown。# 見出し、- 箇条書き、1. 番号つき）
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} className={`${field} font-mono text-[12px]`} />
          </label>
          {errorMessage && <ErrorNotice message={errorMessage} />}
          {result && (
            <p role="status" className="text-[12px] text-done">
              {result}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!canSave} className="h-10 rounded-[8px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink disabled:opacity-45">
              下書きを保存
            </button>
            <button type="button" onClick={() => setConfirming(true)} disabled={!canSave} className="h-10 rounded-[8px] bg-ink px-4 text-[13px] font-semibold text-on-ink disabled:opacity-45">
              この版を公開する
            </button>
          </div>
          <p className="text-[11px] text-muted">公開すると全員に再同意画面（SC-30）が出ます。公開済みの版は直せません（新しい版を作ります）</p>
        </form>

        <section className="rounded-[12px] border border-line bg-surface p-4">
          <h2 className="mb-2 text-[13px] font-bold text-ink">版の一覧</h2>
          <table className="w-full text-[12px] text-ink">
            <thead className="border-b border-line text-[11px] text-muted">
              <tr>
                <th className="py-1 text-left font-medium">版</th>
                <th className="py-1 text-left font-medium">公開日</th>
                <th className="py-1 text-left font-medium">同意済み</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-line last:border-b-0" data-status={v.status}>
                  <td className="py-1.5 font-semibold">{v.version}</td>
                  <td className="py-1.5 text-muted">{v.status === "draft" ? "下書き" : v.publishedAt ? `${shortDate(v.publishedAt)}${v.status === "published" ? " 公開中" : ""}` : "—"}</td>
                  <td className="py-1.5 tabular-nums text-muted">{v.status === "draft" ? "—" : `${v.consentedCount}/${totalUsers}人`}</td>
                  <td className="py-1.5 text-right">
                    {v.status === "draft" ? (
                      <span className="text-muted">編集中</span>
                    ) : (
                      <a href={`${LEGAL_KIND_PATHS[kind]}?version=${encodeURIComponent(v.version)}`} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                        見る ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted">
                    まだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted">
            公開ページ:{" "}
            <a href={LEGAL_KIND_PATHS[kind]} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {LEGAL_KIND_PATHS[kind]}
            </a>
          </p>
        </section>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
            <h2 id="publish-dialog-title" className="mb-3 text-[16px] font-bold text-ink">
              版 {version.trim()} を公開しますか
            </h2>
            <p className="mb-4 text-[13px] leading-[1.7] text-ink">
              公開すると、全員に「規約の改定」のお知らせが届き、次にアプリを開いたときに再同意画面が出ます。公開した版は直せません。
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink">
                キャンセル
              </button>
              <button type="button" onClick={() => void handlePublish()} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] bg-ink text-[14px] font-semibold text-on-ink disabled:opacity-45">
                {isSubmitting ? "公開中…" : "公開する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 公開中が 1.2 なら 1.3 を初期値に（純粋関数） */
export function suggestNextVersion(published: string | null): string {
  if (!published) return "1.0";
  const parts = published.split(".").map((n) => Number.parseInt(n, 10) || 0);
  if (parts.length === 1) return `${parts[0]}.1`;
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const defaultApi: LegalAdminApi = {
  saveDraft: (input) => fetchWithAuthRedirect("/api/admin/legal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
  publish: (id) => fetchWithAuthRedirect(`/api/admin/legal/${id}/publish`, { method: "POST" }),
};
