"use client";

import { useEffect, useMemo, useState } from "react";
import { InAppInvitePanel, type InAppInviteApi } from "@/components/invitations/InAppInvitePanel";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryApi } from "./itinerary-api";

/**
 * itinerary-sharing Task2: 「招待」ダイアログ（リンク発行・コピー・無効化。オーナーのみ）
 * 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
 *
 * 【初心者向け】招待リンクは 7 日で失効。発行直後だけ URL が分かるので、その場でコピーできるようにする。
 * 一覧には有効なリンクだけを出し、「無効化」で使えなくする（アルバムの InviteDialog 相当）。
 */
interface Invitation {
  id: string;
  path: string;
  expiresAt: string;
  createdAt: string;
}

export function InviteDialog({ open, itineraryId, onClose, api }: { open: boolean; itineraryId: string; onClose: () => void; api: ItineraryApi }) {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  /** v3.2: 未回答のアプリ内招待（取り消しの UI 用） */
  const [pending, setPending] = useState<{ id: string; inviteeName: string; expiresAt: string }[]>([]);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inAppApi = useMemo<InAppInviteApi>(
    () => ({ fetchCandidates: () => api.fetchInviteCandidates(itineraryId), searchUsers: api.searchUsers, send: (userId) => api.sendInvitation(itineraryId, userId) }),
    [api, itineraryId]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .listInvitations(itineraryId)
      .then((data) => {
        if (cancelled) return;
        setInvitations(data.invitations);
        setPending(data.pending ?? []);
      })
      .catch((caught) => {
        if (cancelled || caught instanceof UnauthorizedError) return;
        setInvitations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, itineraryId, api]);

  const toUrl = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

  const issue = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await api.issueInvitation(itineraryId);
      if (response.status === 429) {
        setError("招待リンクの発行が多すぎます。時間をおいてお試しください");
        return;
      }
      if (!response.ok) {
        setError("招待リンクを発行できませんでした");
        return;
      }
      const data = (await response.json()) as { invitation: { id: string; path: string; expiresAt: string } };
      setLatestUrl(toUrl(data.invitation.path));
      setInvitations((current) => [{ ...data.invitation, createdAt: new Date().toISOString() }, ...(current ?? [])]);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("招待リンクを発行できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!latestUrl) return;
    try {
      await navigator.clipboard.writeText(latestUrl);
      setCopied(true);
    } catch {
      setError("コピーできませんでした。リンクを選択してコピーしてください");
    }
  };

  const revoke = async (invitationId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.revokeInvitation(itineraryId, invitationId);
      if (!response.ok) {
        setError("無効化できませんでした");
        return;
      }
      setInvitations((current) => (current ?? []).filter((item) => item.id !== invitationId));
      setPending((current) => current.filter((item) => item.id !== invitationId));
      if (latestUrl && invitations?.find((item) => item.id === invitationId && toUrl(item.path) === latestUrl)) setLatestUrl(null);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("無効化できませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="招待" onClose={onClose}>
      <div className="flex flex-col gap-3" data-invite-dialog>
        {/* v3.2（feedback-0919 Task6）: アプリ内招待（一緒だった人・ユーザー名検索）。下はアプリを使っていない人向けのリンク招待 */}
        <InAppInvitePanel api={inAppApi} />
        {pending.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-[12px] font-semibold text-muted">未回答の招待</h3>
            <ul className="flex flex-col gap-1.5" data-pending-invitations>
              {pending.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-line px-3 py-2 text-[12px] text-ink">
                  <span>
                    {item.inviteeName} <span className="text-muted">（{new Date(item.expiresAt).toLocaleDateString("ja-JP")} まで）</span>
                  </span>
                  <button type="button" onClick={() => void revoke(item.id)} disabled={busy} className="text-[12px] font-medium text-saved underline underline-offset-2 disabled:opacity-45">
                    取り消し
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="border-t border-line" />
        <h3 className="text-[12px] font-bold text-ink">
          リンクで招待 <span className="font-normal text-muted">（アプリを使っていない人向け・7 日間有効）</span>
        </h3>
        <p className="text-[12px] leading-[1.7] text-muted">リンクを開いた人がメンバーになります。メンバーはスポットの追加・Day・時刻・メモ・チェックができます。</p>
        <button type="button" onClick={() => void issue()} disabled={busy} className="h-11 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45">
          招待リンクを発行
        </button>
        {latestUrl && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-app p-3">
            <input readOnly value={latestUrl} aria-label="招待リンク" onFocus={(event) => event.target.select()} className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink" />
            <button type="button" onClick={() => void copy()} className="h-9 rounded-[8px] bg-ink text-[12px] font-semibold text-on-ink">
              {copied ? "コピーしました" : "リンクをコピー"}
            </button>
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        <div>
          <h3 className="mb-1.5 text-[12px] font-semibold text-muted">有効な招待リンク</h3>
          {invitations === null ? (
            <p className="text-[12px] text-muted">読み込んでいます…</p>
          ) : invitations.length === 0 ? (
            <p className="text-[12px] text-muted">有効なリンクはありません</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {invitations.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-line px-3 py-2 text-[12px] text-ink">
                  <span>{new Date(item.expiresAt).toLocaleDateString("ja-JP")} まで有効</span>
                  <button type="button" onClick={() => void revoke(item.id)} disabled={busy} className="text-[12px] font-medium text-saved underline underline-offset-2 disabled:opacity-45">
                    無効化
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
