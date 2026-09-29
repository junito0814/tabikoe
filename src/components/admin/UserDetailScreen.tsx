"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { AdminUserDetail } from "@/lib/admin/user-detail";
import { StrikeDots } from "./StrikeDots";
import { StatusChip } from "./UserListScreen";
import { relativeTime } from "./AdminDashboardScreen";

/** 操作の種類 → API のパス。テストで差し替えられるよう関数にしている */
export type UserActionKind = "suspend" | "unsuspend" | "confirm" | "revoke";
export type SubmitUserAction = (kind: UserActionKind, targetId: string, body: Record<string, unknown>) => Promise<Response>;

/**
 * user-management Task 2: 利用者詳細（SC-24 詳細）
 * 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
 *       docs/wireframes.md「SC-24 利用者詳細」
 *
 * 【初心者向け】左に本人の情報とストライクの履歴・タブ（投稿／コメント／通報された／この人への操作）、
 * 右に「アカウントへの操作」（理由が必須。停止・解除・仮停止の確定）と「いま受けている制限」。
 * 停止・解除・取り消しはすべて確認ダイアログを挟み、確定したら API を呼んで router.refresh() で取り直す。
 */
export function UserDetailScreen({ user, submitAction = defaultSubmit }: { user: AdminUserDetail; submitAction?: SubmitUserAction }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [hidePosts, setHidePosts] = useState(true);
  const [restorePosts, setRestorePosts] = useState(true);
  const [tab, setTab] = useState<"posts" | "comments" | "reports" | "actions">("posts");
  const [confirming, setConfirming] = useState<{ kind: UserActionKind; targetId: string; title: string; description: string; noteValue: string } | null>(null);
  const [revokeNotes, setRevokeNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // 描画中に Date.now() を呼ばない（react-hooks/purity）。開いた時点の時刻で判定すれば十分
  const [openedAt] = useState(() => Date.now());

  const isSuspended = user.status === "suspended" || user.status === "provisional";

  const run = async () => {
    if (!confirming || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const body: Record<string, unknown> = { note: confirming.noteValue };
      if (confirming.kind === "suspend") body.hidePosts = hidePosts;
      if (confirming.kind === "unsuspend") body.restorePosts = restorePosts;
      const response = await submitAction(confirming.kind, confirming.targetId, body);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error === "note_required" ? "理由を入力してください" : "操作を記録できませんでした");
        return;
      }
      setResult(`${confirming.title}を記録しました`);
      setConfirming(null);
      setNote("");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("操作を記録できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirm = (kind: UserActionKind, targetId: string, title: string, description: string, noteValue: string) => {
    if (!noteValue.trim()) {
      setErrorMessage("理由を入力してください");
      return;
    }
    setErrorMessage(null);
    setConfirming({ kind, targetId, title, description, noteValue: noteValue.trim() });
  };

  const button = "h-10 rounded-[8px] px-4 text-[13px] font-semibold disabled:opacity-45";

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* 本人 */}
        <section className="rounded-[12px] border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-bold text-ink">{user.displayName}</h2>
              <p className="text-[12px] text-muted">
                {user.email} ・ 登録 {shortDate(user.createdAt)} ・ 最終利用 {user.lastActiveAt ? relativeTime(user.lastActiveAt) : "—"}
              </p>
            </div>
            <StatusChip status={user.status} until={user.postingRestrictedUntil} />
          </div>
          <p className="mt-3 text-[12px] text-muted">
            投稿 {user.counts.posts} ｜ コメント {user.counts.comments} ｜ 通報された {user.counts.reported} ｜ 有効なストライク{" "}
            <span className="font-semibold text-ink">
              {user.activeStrikeCount}/{user.strikesToSuspend}
            </span>{" "}
            <StrikeDots active={user.activeStrikeCount} max={user.strikesToSuspend} />
          </p>
        </section>

        {/* ストライクの履歴 */}
        <section className="rounded-[12px] border border-line bg-surface p-4">
          <h3 className="mb-2 text-[13px] font-bold text-ink">ストライクの履歴</h3>
          {user.strikes.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">ありません</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-[12px]">
              {user.strikes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-strike={s.state}>
                  <span className="tabular-nums text-muted">{shortDate(s.createdAt)}</span>
                  <span className="font-semibold text-ink">
                    {s.reasonLabel}（{s.actionLabel}）
                  </span>
                  {s.targetLabel && <span className="text-muted">{s.targetLabel}</span>}
                  <span className={`ml-auto ${s.state === "active" ? "text-ink" : "text-muted"}`}>
                    {s.state === "active" ? `${shortDate(s.expiresAt)}まで有効` : s.state === "expired" ? "失効（90日経過）" : "取り消し済み"}
                  </span>
                  {s.state === "active" && (
                    <span className="flex items-center gap-1">
                      <input
                        aria-label={`取り消しの理由（${shortDate(s.createdAt)}）`}
                        placeholder="理由"
                        value={revokeNotes[s.id] ?? ""}
                        onChange={(e) => setRevokeNotes({ ...revokeNotes, [s.id]: e.target.value })}
                        className="h-8 w-[140px] rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => openConfirm("revoke", s.id, "ストライクの取り消し", "このストライクを取り消し、投稿禁止の期間を決め直します。記録には残ります。", revokeNotes[s.id] ?? "")}
                        className="h-8 rounded-[8px] border border-line px-2 text-[12px] text-ink"
                      >
                        取り消す
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* タブ */}
        <section className="rounded-[12px] border border-line bg-surface p-4">
          <div role="tablist" className="mb-3 flex flex-wrap gap-1 text-[12px]">
            {(
              [
                ["posts", `投稿 ${user.counts.posts}`],
                ["comments", `コメント ${user.counts.comments}`],
                ["reports", `通報された ${user.counts.reported}`],
                ["actions", `この人への操作 ${user.actionsOn.length}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`h-8 rounded-full px-3 font-medium ${tab === key ? "bg-tint text-accent" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "posts" && (
            <List
              empty="投稿はありません"
              rows={user.posts.map((p) => ({
                key: p.id,
                cells: [p.publishedAt ? shortDate(p.publishedAt) : "—", p.spotName, p.category, p.isPublic ? "公開" : "非公開"],
                href: `/posts/${p.id}`,
              }))}
            />
          )}
          {tab === "comments" && (
            <List
              empty="コメントはありません"
              rows={user.comments.map((c) => ({ key: c.id, cells: [shortDate(c.createdAt), c.body.slice(0, 40), c.isHidden ? "非公開" : "公開"], href: `/posts/${c.postId}` }))}
            />
          )}
          {tab === "reports" && (
            <List
              empty="通報されたことはありません"
              rows={user.reportsAgainst.map((r) => ({ key: r.id, cells: [shortDate(r.createdAt), r.targetLabel, r.reasonLabel, r.statusLabel], href: `/admin/reports/${r.id}`, internal: true }))}
            />
          )}
          {tab === "actions" && (
            <List
              empty="操作はまだありません"
              rows={user.actionsOn.map((a) => ({ key: a.id, cells: [shortDate(a.createdAt), a.actorName, a.actionLabel, a.note ?? "—"] }))}
            />
          )}
        </section>
      </div>

      {/* 右: 操作 */}
      <div className="flex flex-col gap-4">
        <section className="rounded-[12px] border border-line bg-surface p-4">
          <h3 className="mb-2 text-[13px] font-bold text-ink">アカウントへの操作</h3>
          <label className="text-[11px] text-muted">
            理由（メモ・必須）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-0.5 block w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-[12px] text-ink" />
          </label>
          {!isSuspended && (
            <label className="mt-2 flex items-center gap-2 text-[12px] text-ink">
              <input type="checkbox" checked={hidePosts} onChange={(e) => setHidePosts(e.target.checked)} />
              この人の公開投稿をすべて非公開にする
            </label>
          )}
          {isSuspended && (
            <label className="mt-2 flex items-center gap-2 text-[12px] text-ink">
              <input type="checkbox" checked={restorePosts} onChange={(e) => setRestorePosts(e.target.checked)} />
              停止で非公開にした投稿を元に戻す
            </label>
          )}
          {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}
          {result && (
            <p role="status" className="mt-2 text-[12px] text-done">
              {result}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {user.status === "provisional" && (
              <button
                type="button"
                onClick={() => openConfirm("confirm", user.id, "仮停止の確定", "自動の仮停止を管理者の判断として確定します。挙動は変わりません。", note)}
                className={`${button} bg-ink text-on-ink`}
              >
                仮停止を確定する
              </button>
            )}
            {!isSuspended && (
              <button
                type="button"
                onClick={() => openConfirm("suspend", user.id, "アカウントの停止", "この人はログインできなくなります。本人に理由が通知されます。", note)}
                className={`${button} bg-saved text-white`}
              >
                アカウントを停止する
              </button>
            )}
            <button
              type="button"
              disabled={!isSuspended}
              onClick={() => openConfirm("unsuspend", user.id, "停止の解除", "この人は再びログインできるようになります。本人に通知されます。", note)}
              className={`${button} border border-line bg-surface text-ink`}
            >
              停止を解除する
            </button>
          </div>
        </section>

        <section className="rounded-[12px] border border-line bg-surface p-4 text-[12px]">
          <h3 className="mb-2 text-[13px] font-bold text-ink">この人が受ける制限（今）</h3>
          {isSuspended ? (
            <p className="text-ink">ログイン不可（{user.status === "provisional" ? "仮停止" : "停止"}）</p>
          ) : user.postingRestrictedUntil && new Date(user.postingRestrictedUntil).getTime() > openedAt ? (
            <p className="text-ink">投稿・コメント 禁止（{shortDate(user.postingRestrictedUntil)}まで）</p>
          ) : (
            <p className="text-muted">制限なし</p>
          )}
          <p className="mt-1 text-muted">次のストライクで {user.nextMeasure}</p>
        </section>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="user-action-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
            <h2 id="user-action-dialog-title" className="mb-3 text-[16px] font-bold text-ink">
              {confirming.title}
            </h2>
            <p className="mb-2 text-[13px] leading-[1.7] text-ink">{confirming.description}</p>
            <p className="mb-4 text-[12px] text-muted">理由: {confirming.noteValue}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(null)} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink">
                キャンセル
              </button>
              <button type="button" onClick={() => void run()} disabled={isSubmitting} className="h-11 flex-1 rounded-[10px] bg-ink text-[14px] font-semibold text-on-ink disabled:opacity-45">
                {isSubmitting ? "記録中…" : "実行する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function List({ rows, empty }: { rows: { key: string; cells: string[]; href?: string; internal?: boolean }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-3 text-center text-[12px] text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line text-[12px]">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-center gap-x-3 py-2">
          {row.cells.map((cell, i) => (
            <span key={i} className={i === 0 ? "tabular-nums text-muted" : i === 1 ? "font-semibold text-ink" : "text-muted"}>
              {cell}
            </span>
          ))}
          {row.href &&
            (row.internal ? (
              <Link href={row.href} className="ml-auto text-accent underline underline-offset-2">
                開く
              </Link>
            ) : (
              <a href={row.href} target="_blank" rel="noreferrer" className="ml-auto text-accent underline underline-offset-2">
                見る ↗
              </a>
            ))}
        </li>
      ))}
    </ul>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function defaultSubmit(kind: UserActionKind, targetId: string, body: Record<string, unknown>): Promise<Response> {
  const path =
    kind === "revoke"
      ? `/api/admin/strikes/${targetId}/revoke`
      : `/api/admin/users/${targetId}/${kind === "confirm" ? "confirm-suspension" : kind}`;
  return fetchWithAuthRedirect(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
