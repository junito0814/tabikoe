import Link from "next/link";
import type { AccountStatus } from "@/lib/moderation/account-status";
import { StrikeDots } from "@/components/admin/StrikeDots";

/**
 * strike-system Task 5: アカウントの状態（SC-28）
 * 出典: docs/tasks/safety/strike-system/05-account-status.md
 *       docs/wireframes.md「SC-28 アカウントの状態」
 *
 * 【初心者向け】表示だけ（状態も通信も持たない）。制限中は上に青い帯（解除日・使えること）、
 * ストライクの丸 5 つ、履歴の各行に理由と利用規約の該当条へのリンク（/terms は legal-documents Task 1 で作る）。
 */
export function AccountStatusScreen({ status }: { status: AccountStatus }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex items-center gap-3">
          <Link href="/mypage" aria-label="マイページへ戻る" className="text-[20px] text-ink">
            ‹
          </Link>
          <h1 className="text-[18px] font-bold text-ink">アカウントの状態</h1>
        </header>

        {status.restrictedUntil ? (
          <section role="note" className="rounded-[12px] border border-accent/40 bg-tint p-4 text-[13px] leading-[1.7] text-ink">
            <p className="font-bold">いま、投稿とコメントができません</p>
            <p>
              {formatDateTime(status.restrictedUntil)} まで。閲覧・保存・しおりはこれまでどおり使えます
            </p>
          </section>
        ) : (
          <section className="rounded-[12px] border border-line bg-surface p-4 text-[13px] text-muted">いまは制限を受けていません</section>
        )}

        <section className="rounded-[12px] border border-line bg-surface p-4 text-[13px] text-ink">
          <p className="flex items-center gap-2">
            有効な違反の記録{" "}
            <span className="font-bold tabular-nums">
              {status.activeStrikes}/{status.strikesToSuspend}
            </span>
            <StrikeDots active={status.activeStrikes} max={status.strikesToSuspend} />
          </p>
          <p className="mt-1 text-[12px] text-muted">
            記録は{status.expiryDays}日で消えます。{status.strikesToSuspend}つで停止になります。次の記録で {status.nextMeasure}
          </p>
        </section>

        <section className="rounded-[12px] border border-line bg-surface p-4">
          <h2 className="mb-2 text-[13px] font-bold text-ink">履歴</h2>
          {status.history.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">記録はありません</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-[12px]">
              {status.history.map((h) => (
                <li key={h.id} className={`py-2 ${h.state === "expired" ? "text-muted" : "text-ink"}`} data-state={h.state}>
                  <span className="tabular-nums text-muted">{shortDate(h.createdAt)}</span> {h.summary}。理由：{h.reasonLabel}。
                  <Link href="/terms#article-4" className="underline underline-offset-2">
                    利用規約 第4条
                  </Link>
                  {h.state === "expired" && <span className="ml-1">（{"90"}日経過のため失効）</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
