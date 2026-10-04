"use client";

import { useState } from "react";
import { hardRedirect } from "@/lib/navigation/hard-redirect";
import { ConsentCheckbox } from "@/components/auth/ConsentCheckbox";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { LEGAL_KIND_LABELS, LEGAL_KIND_PATHS, type LegalKind } from "@/lib/legal/legal-documents";

export interface ReconsentItem {
  kind: LegalKind;
  version: string;
  /** 変更の要点（管理者が書いたもの。無ければ出さない） */
  summary: string;
}

/**
 * legal-documents Task 3: 規約の再同意（SC-30）
 * 出典: docs/tasks/admin/legal-documents/03-reconsent.md
 *       docs/wireframes.md「SC-30 規約の再同意」
 *
 * 【初心者向け】新しい版が公開されたあと、最初に開いたときに出る。同意するまで他の画面には進めない（関所が止める）。
 * 変更の要点と全文へのリンクを置き、全部にチェックして「同意して続ける」で POST /api/legal/consent → 元いた画面へ戻す。
 */
export function ReconsentScreen({
  items,
  redirectTo,
  submit = defaultSubmit,
}: {
  items: ReconsentItem[];
  redirectTo: string;
  submit?: (kinds: LegalKind[]) => Promise<Response>;
}) {
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit = items.every((item) => agreed[item.kind]) && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submit(items.map((item) => item.kind));
      if (!response.ok) {
        setErrorMessage("同意を記録できませんでした。時間をおいてお試しください");
        return;
      }
      // #705 と同じ理由。同意の状態が変わった直後なので読み込み直す
      hardRedirect(redirectTo);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("同意を記録できませんでした。時間をおいてお試しください");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = items.length === 1 ? `${LEGAL_KIND_LABELS[items[0].kind]}が変わりました（${items[0].version}）` : "利用規約・個人情報保護方針が変わりました";

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-6 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-5">
        <h1 className="text-[18px] font-bold text-ink">{title}</h1>
        {items.map((item) => (
          <section key={item.kind} className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-4 text-[13px] leading-[1.7] text-ink">
            <p className="font-bold">
              {LEGAL_KIND_LABELS[item.kind]}（版 {item.version}）
            </p>
            {item.summary && (
              <div>
                <p className="text-[12px] font-medium text-muted">変更の要点</p>
                <p className="whitespace-pre-line">{item.summary}</p>
              </div>
            )}
            <a href={LEGAL_KIND_PATHS[item.kind]} target="_blank" rel="noreferrer" className="text-[12px] text-accent underline underline-offset-2">
              全文を読む →
            </a>
            <ConsentCheckbox checked={!!agreed[item.kind]} onChange={(next) => setAgreed((current) => ({ ...current, [item.kind]: next }))} label={LEGAL_KIND_LABELS[item.kind]} />
          </section>
        ))}
        {errorMessage && <ErrorNotice message={errorMessage} />}
        <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit} className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
          {isSubmitting ? "記録中..." : "同意して続ける"}
        </button>
        <p className="text-center text-[11px] text-muted">同意するまで他の画面には進めません</p>
      </div>
    </div>
  );
}

function defaultSubmit(kinds: LegalKind[]): Promise<Response> {
  return fetchWithAuthRedirect("/api/legal/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kinds }) });
}
