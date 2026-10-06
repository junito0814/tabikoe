"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { InviteCandidate } from "@/lib/invitations/in-app";
import type { UserSummary } from "@/lib/users/search-users";

export interface InAppInviteApi {
  /** 「一緒だった人」の候補 */
  fetchCandidates: () => Promise<{ candidates: InviteCandidate[] }>;
  /** ユーザー名の検索（2 文字以上） */
  searchUsers: (query: string) => Promise<{ users: UserSummary[] }>;
  /** 招待を送る（201 なら成功。409 already_pending／already_member、404 invitee_not_found） */
  send: (userId: string) => Promise<Response>;
}

/**
 * feedback-0919 Task6（v3.2）: アプリ内招待の入力（しおりの InviteDialog とアルバム画面で共通）
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
 *       要件定義書 v3.2 3.6.3「アプリ内招待」
 *
 * 【初心者向け】上段に検索欄（2 文字以上で 300ms 後に検索）、下段に「一緒だった人」（同じアルバム・しおりに入ったことがある人）。
 * どちらの行にも「招待を送る」があり、送ると相手の通知一覧に届く。未回答の相手は「送信済み」にする。
 * 検索と候補の両方に出る人は重複させない。
 */
export function InAppInvitePanel({ api, className }: { api: InAppInviteApi; className?: string }) {
  const [candidates, setCandidates] = useState<InviteCandidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  // loading-feedback Task 2（2026-09-30）: 「どの語で探し終えたか」を覚えておく。
  // これが無いと、結果が返るまでの間ずっと「見つかりませんでした」と出ていた（要件 4.5.11）。
  // 探している最中かどうかは state を足さず、これと今の入力を見比べて求める
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchCandidates()
      .then((data) => {
        if (!cancelled) setCandidates(data.candidates);
      })
      .catch((caught) => {
        if (cancelled || caught instanceof UnauthorizedError) return;
        setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  // 検索: 入力が 300ms 止まったら（2 文字未満は結果を出さない。setState は必ず非同期の後で行う）
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      api
        .searchUsers(q)
        .then((data) => {
          if (cancelled) return;
          setResults(data.users);
          setSearchedQuery(q);
        })
        .catch((caught) => {
          if (cancelled || caught instanceof UnauthorizedError) return;
          setResults([]);
          setSearchedQuery(q);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, api]);

  const send = async (user: UserSummary) => {
    if (busyId) return;
    setBusyId(user.id);
    setError(null);
    try {
      const response = await api.send(user.id);
      if (response.status === 429) {
        setError("招待の送信が多すぎます。時間をおいてお試しください");
        return;
      }
      if (response.status === 409) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error === "already_member" ? `${user.displayName}さんは既にメンバーです` : `${user.displayName}さんには未回答の招待があります`);
        setSent((current) => new Set(current).add(user.id));
        return;
      }
      if (!response.ok) {
        setError("招待を送れませんでした");
        return;
      }
      setSent((current) => new Set(current).add(user.id));
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("招待を送れませんでした");
    } finally {
      setBusyId(null);
    }
  };

  const isSent = (user: UserSummary & { pendingInvitationId?: string | null }) => sent.has(user.id) || Boolean(user.pendingInvitationId);
  const candidateIds = new Set((candidates ?? []).map((candidate) => candidate.id));
  const searchOnly = results.filter((user) => !candidateIds.has(user.id) || query.trim().length >= 2);
  // 探している最中か（デバウンスで待っている間も含む）。今の入力と「探し終えた語」が違えばまだ探している
  const isSearching = query.trim().length >= 2 && searchedQuery !== query.trim();

  const row = (user: UserSummary & { pendingInvitationId?: string | null }) => (
    <li key={user.id} className="flex items-center gap-2" data-invite-user={user.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-ink">{user.displayName}</span>
      {isSent(user) ? (
        <span className="text-[0.6875rem] text-muted">送信済み</span>
      ) : (
        <button
          type="button"
          onClick={() => void send(user)}
          disabled={busyId !== null}
          aria-label={`${user.displayName}に招待を送る`}
          className="h-8 rounded-full bg-accent px-3 text-[0.75rem] font-bold text-white disabled:opacity-45"
        >
          {busyId === user.id ? "送信中…" : "招待を送る"}
        </button>
      )}
    </li>
  );

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`} data-in-app-invite>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ユーザー名で探す"
        aria-label="ユーザー名で探す"
        className="h-10 rounded-[10px] border border-line bg-surface px-3 text-[0.8125rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {query.trim().length >= 2 && (
        <ul className="flex flex-col gap-2" aria-label="検索結果">
          {/* 探し終わるまでは「見つかりませんでした」と言わない（要件 4.5.11 の共通の決まり） */}
          {isSearching ? (
            <li className="text-[0.75rem] text-muted">探しています…</li>
          ) : searchOnly.length === 0 ? (
            <li className="text-[0.75rem] text-muted">見つかりませんでした</li>
          ) : (
            searchOnly.map((user) => row(user))
          )}
        </ul>
      )}
      <div>
        <h3 className="mb-1.5 text-[0.75rem] font-bold text-ink">一緒だった人</h3>
        {candidates === null ? (
          <p className="text-[0.75rem] text-muted">読み込んでいます…</p>
        ) : candidates.length === 0 ? (
          <p className="text-[0.75rem] text-muted">まだいません。リンクで招待できます</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="一緒だった人">
            {candidates.map((candidate) => row(candidate))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[0.75rem] text-saved">
          {error}
        </p>
      )}
    </div>
  );
}

/** ユーザー名の検索 API（しおり・アルバム共通） */
export async function searchUsersRequest(query: string): Promise<{ users: UserSummary[] }> {
  const response = await fetchWithAuthRedirect(`/api/users/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Failed to search users: ${response.status}`);
  return (await response.json()) as { users: UserSummary[] };
}
