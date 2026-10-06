"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { InAppInvitePanel, searchUsersRequest, type InAppInviteApi } from "@/components/invitations/InAppInvitePanel";
import type { InviteCandidate } from "@/lib/invitations/in-app";
import type { UserSummary } from "@/lib/users/search-users";
import { useRouter } from "next/navigation";
import { MediaGrid } from "@/components/media/MediaGrid";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ReportLink } from "@/components/reports/ReportLink";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { AlbumDetail, AlbumMember } from "@/lib/albums/get-album";
import { ALBUM_ROLE_LABELS, INVITABLE_ROLES, type InvitableRole } from "@/lib/albums/membership";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";
import { formatCost } from "@/components/posts/PostCard";

export interface AlbumInvitation {
  id: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  status: "valid" | "revoked" | "expired";
  /** 発行直後にだけ分かる招待URLのパス */
  path?: string;
}

export interface AlbumApi {
  rename: (tripId: string, title: string) => Promise<Response>;
  issueInvitation: (tripId: string, role: InvitableRole) => Promise<Response>;
  revokeInvitation: (tripId: string, invitationId: string) => Promise<Response>;
  /** v3.2: アプリ内招待（候補・検索・送信）。省略時はアプリ内招待の段を出さない（単体テスト用） */
  fetchInviteCandidates?: (tripId: string) => Promise<{ candidates: InviteCandidate[] }>;
  searchUsers?: (query: string) => Promise<{ users: UserSummary[] }>;
  sendInvitation?: (tripId: string, inviteeUserId: string, role: InvitableRole) => Promise<Response>;
  changeRole: (tripId: string, userId: string, role: InvitableRole) => Promise<Response>;
  removeMember: (tripId: string, userId: string) => Promise<Response>;
  leave: (tripId: string) => Promise<Response>;
  /** #715: 投稿 0 件のアルバムを消す */
  deleteAlbum?: (tripId: string) => Promise<Response>;
}

/**
 * F-RC-02 Task3・Task4 / F-RC-03（管理UI）: アルバム画面（SC-09）
 * 出典: docs/tasks/records/album/03-album-title-rename-integration.md
 *       docs/tasks/records/album/04-album-media-grid-ui.md
 *       docs/tasks/records/album-collaboration/00-index.md（招待発行・無効化・権限変更・削除・退出の操作UI）
 *
 * - 名称変更（trip-title Task3 の PATCH /api/trips/[id]）はオーナーにだけ。v3.1: ボタンではなくタイトルのタップ（しおりが無いアルバムだけ。「日常」は不可）
 * - 招待リンクの発行・無効化、メンバーの権限変更・削除もオーナーのみ
 * - 編集者・閲覧者には「退出」を出す
 * - 投稿は公開・非公開を問わず MediaGrid で表示し、旅行タイトルを見せてよい画面（trip-title Task5）
 *
 * 【初心者向け】操作が 6 種類（名前変更・招待発行・無効化・権限変更・削除・退出）あるので、
 * 共通の `run()` に「二重実行の防止（busy）・エラー表示・後始末」をまとめ、各 handle〜 は API 呼び出しと
 * state の更新だけを書いている。`api` を props で差し替えられるのは単体テストのため。
 */
export function AlbumScreen({
  album,
  initialInvitations,
  viewerId,
  api = defaultApi,
  back = null,
}: {
  /** Bug #471: 直前の画面（`?back=` から page.tsx が解決）。無ければ既定の戻り先 */
  back?: { href: string; label: string } | null;
  album: AlbumDetail;
  initialInvitations: AlbumInvitation[];
  viewerId: string;
  /** 差し替え口（単体テスト用） */
  api?: AlbumApi;
}) {
  const router = useRouter();
  const isOwner = album.viewerRole === "owner";
  // v3.1（mentoring-7 Task2）: 「日常」は名前変更・招待ができない（オーナーでも出さない）
  const canManage = isOwner && !album.isDaily;
  const [title, setTitle] = useState(album.title);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(album.title);
  const [members, setMembers] = useState<AlbumMember[]>(album.members);
  const [invitations, setInvitations] = useState<AlbumInvitation[]>(initialInvitations);
  const [inviteRole, setInviteRole] = useState<InvitableRole>("viewer");
  const [issuedPath, setIssuedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /*
   * #742: 削除は「⋯」の中（しおり詳細と同じ形）。
   * 投稿が 0 件のときだけ出す ── 投稿があるアルバムを消すと中の投稿も一緒に消えるため。
   */
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canDeleteAlbum = canManage && album.posts.length === 0 && api.deleteAlbum !== undefined;

  // 外をタップしたら閉じる（しおり詳細と同じ）
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMenuOpen]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // すべての操作の共通枠。busy に操作名を入れて、完了まで他のボタンを無効にする
  const run = async (key: string, action: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(key);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(failure);
    } finally {
      setBusy(null);
    }
  };

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    const next = draftTitle.trim();
    if (next.length === 0 || next === title) {
      setIsRenaming(false);
      return;
    }
    void run(
      "rename",
      async () => {
        const response = await api.rename(album.tripId, next);
        if (!response.ok) throw new Error("rename failed");
        setTitle(next);
        setIsRenaming(false);
      },
      "アルバム名を変更できませんでした（同じ名前の旅行がある場合は変更できません）"
    );
  };

  const handleIssue = () =>
    run(
      "issue",
      async () => {
        const response = await api.issueInvitation(album.tripId, inviteRole);
        if (!response.ok) throw new Error("issue failed");
        const data = (await response.json()) as { invitation: AlbumInvitation };
        setInvitations((current) => [{ ...data.invitation, status: "valid" }, ...current]);
        setIssuedPath(data.invitation.path ?? null);
      },
      "招待リンクを発行できませんでした"
    );

  const handleRevoke = (invitationId: string) =>
    run(
      `revoke:${invitationId}`,
      async () => {
        const response = await api.revokeInvitation(album.tripId, invitationId);
        if (!response.ok) throw new Error("revoke failed");
        setInvitations((current) =>
          current.map((invitation) =>
            invitation.id === invitationId ? { ...invitation, status: "revoked" } : invitation
          )
        );
      },
      "招待リンクを無効化できませんでした"
    );

  const handleChangeRole = (userId: string, role: InvitableRole) =>
    run(
      `role:${userId}`,
      async () => {
        const response = await api.changeRole(album.tripId, userId, role);
        if (!response.ok) throw new Error("role failed");
        setMembers((current) => current.map((member) => (member.userId === userId ? { ...member, role } : member)));
      },
      "権限を変更できませんでした"
    );

  const handleRemove = (member: AlbumMember) => {
    if (!window.confirm(`${member.displayName}をアルバムから削除しますか？`)) return;
    void run(
      `remove:${member.userId}`,
      async () => {
        const response = await api.removeMember(album.tripId, member.userId);
        if (!response.ok) throw new Error("remove failed");
        setMembers((current) => current.filter((item) => item.userId !== member.userId));
      },
      "メンバーを削除できませんでした"
    );
  };

  /** #715: 投稿 0 件のアルバムを消す。確認してから */
  const handleDeleteAlbum = () => {
    if (!api.deleteAlbum) return;
    if (!window.confirm(`「${title}」を削除しますか？（取り消せません）`)) return;
    void run(
      "delete",
      async () => {
        const response = await api.deleteAlbum!(album.tripId);
        if (!response.ok) throw new Error("delete failed");
        router.push("/albums");
        router.refresh();
      },
      "削除できませんでした"
    );
  };

  const handleLeave = () => {
    if (!window.confirm("このアルバムから退出しますか？（これまでの自分の投稿はアルバムに残ります）")) return;
    void run(
      "leave",
      async () => {
        const response = await api.leave(album.tripId);
        if (!response.ok) throw new Error("leave failed");
        router.push("/albums");
        router.refresh();
      },
      "退出できませんでした"
    );
  };

  // 招待リンクは相対パスで返ってくるので、表示用にブラウザの origin（https://…）を前に付ける
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inAppApi = useMemo<InAppInviteApi | null>(
    () =>
      api.fetchInviteCandidates && api.searchUsers && api.sendInvitation
        ? {
            fetchCandidates: () => api.fetchInviteCandidates!(album.tripId),
            searchUsers: api.searchUsers,
            send: (userId) => api.sendInvitation!(album.tripId, userId, inviteRole),
          }
        : null,
    [api, album.tripId, inviteRole]
  );

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="flex w-full max-w-[560px] flex-col gap-5">
        <header className="flex flex-col gap-2">
          {/* Bug #471: どこから来たかで戻り先を変える（しおり・通知など）。無ければアルバム一覧 */}
          <Link href={back?.href ?? "/albums"} className="text-[12px] text-muted underline underline-offset-2">
            ← {back?.label ?? "アルバム一覧"}
          </Link>
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex gap-2">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                maxLength={MAX_TRIP_TITLE_LENGTH * 2}
                aria-label="アルバム名"
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 text-[14px] text-ink"
              />
              {/*
                * loading-feedback Task 4-8（2026-10-02）: `run(key, …)` が「どの操作か」を
                * もう持っているので、その key を見て押したボタンだけ文言を変える。
                * 以前は招待リンクの発行だけに「発行中…」があり、他は押せなくなるだけだった。
                */}
              <button type="submit" disabled={busy !== null} className="h-10 rounded-[8px] bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-45">
                {busy === "rename" ? "保存しています…" : "保存"}
              </button>
              <button type="button" onClick={() => setIsRenaming(false)} className="h-10 rounded-[8px] border border-line bg-surface px-3 text-[12px] text-ink">
                取消
              </button>
            </form>
          ) : (
            // v3.1（mentoring-7 Task9）: 「名前を変更」ボタンは置かない。しおりが無いアルバムだけタイトルをタップで変更。
            // しおりがあるアルバムは名前をしおり詳細のタイトルで変える（名前は 1 つ）
            /*
             * #742: タイトルの鉛筆の印を外した（押せば編集できるものに印を付けない。#694 と同じ考え方）。
             * 右に「⋯」を置き、削除はその中へ移した（しおり詳細と同じ形）。
             */
            <div className="flex items-start gap-2" ref={menuRef}>
              {canManage && !album.itineraryId ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftTitle(title);
                    setIsRenaming(true);
                  }}
                  aria-label={`${title}（名前を変更）`}
                  className="min-w-0 flex-1 break-words text-left text-[20px] font-bold text-ink"
                >
                  {title}
                </button>
              ) : (
                <h1 className="min-w-0 flex-1 break-words text-[20px] font-bold text-ink">{title}</h1>
              )}
              {canDeleteAlbum && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label="その他"
                    className="h-8 w-8 rounded-full border border-line bg-surface text-[14px] font-bold text-ink"
                  >
                    ⋯
                  </button>
                  {isMenuOpen && (
                    <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-[170px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsMenuOpen(false);
                            void handleDeleteAlbum();
                          }}
                          disabled={busy !== null}
                          className="flex w-full px-3 py-2 text-left text-[13px] text-saved hover:bg-tint disabled:opacity-45"
                        >
                          {busy === "delete" ? "削除しています…" : "このアルバムを削除"}
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted">
            あなたの権限: {ALBUM_ROLE_LABELS[album.viewerRole]} ・ 投稿 {album.posts.length}件 ・ メンバー {members.length}人
          </p>
          <div className="flex flex-wrap gap-2">
            {/* F-RC-05（SC-21）: このアルバムの写真・動画だけを並べて眺める（非公開投稿も含む） */}
            <Link href={`/albums/${album.tripId}/photos`} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
              写真
            </Link>
            {/* itinerary-basics Task4: しおりのメンバーにだけ「しおりを見る」 */}
            {album.itineraryId && (
              <Link href={`/itineraries/${album.itineraryId}?back=${encodeURIComponent(`/albums/${album.tripId}`)}`} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
                しおりを見る
              </Link>
            )}
          </div>
        </header>

        {errorMessage && <ErrorNotice message={errorMessage} />}

        <section aria-labelledby="members-heading" className="rounded-[12px] border border-line bg-surface p-4">
          <h2 id="members-heading" className="mb-2 text-[13px] font-bold text-ink">メンバー</h2>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center gap-2 text-[12px]" data-member={member.userId}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={member.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {member.displayName}
                  {member.userId === viewerId && <span className="ml-1 text-muted">（あなた）</span>}
                </span>
                {isOwner && member.role !== "owner" ? (
                  <>
                    <select
                      value={member.role}
                      aria-label={`${member.displayName}の権限`}
                      onChange={(event) => void handleChangeRole(member.userId, event.target.value as InvitableRole)}
                      disabled={busy !== null}
                      className="h-8 rounded-[6px] border border-line bg-surface px-2 text-[12px]"
                    >
                      {INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ALBUM_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    {/*
                      * Task 4-8: 権限は `<select>` なので中の文字を「変更中…」にはできない
                      * （選択肢の名前を書き換えると、何を選んでいるのか分からなくなる）。
                      * 代わりに隣に小さく出す。
                      */}
                    {busy === `role:${member.userId}` && (
                      <span role="status" className="text-[11px] text-muted">
                        変更しています…
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={busy !== null}
                      aria-label={`${member.displayName}を削除`}
                      className="text-[11px] font-medium text-accent underline underline-offset-2 disabled:opacity-45"
                    >
                      {busy === `remove:${member.userId}` ? "削除中…" : "削除"}
                    </button>
                  </>
                ) : (
                  <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] text-muted">{ALBUM_ROLE_LABELS[member.role]}</span>
                )}
              </li>
            ))}
          </ul>
          {!isOwner && (
            <button
              type="button"
              onClick={handleLeave}
              disabled={busy !== null}
              className="mt-3 text-[12px] font-medium text-muted underline underline-offset-2 disabled:opacity-45"
            >
              {busy === "leave" ? "退出しています…" : "このアルバムから退出"}
            </button>
          )}
        </section>

        {canManage && (
          <section aria-labelledby="invite-heading" className="rounded-[12px] border border-line bg-surface p-4">
            <h2 id="invite-heading" className="mb-2 text-[13px] font-bold text-ink">招待</h2>
            <label className="mb-2 flex items-center gap-2 text-[12px] text-muted">
              付与する権限
              <select
                value={inviteRole}
                aria-label="付与する権限"
                onChange={(event) => setInviteRole(event.target.value as InvitableRole)}
                className="h-9 rounded-[6px] border border-line bg-surface px-2 text-[12px] text-ink"
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ALBUM_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            {/* v3.2（feedback-0919 Task6）: アプリ内招待（一緒だった人・ユーザー名検索）。選んだ権限で送る */}
            {inAppApi && <InAppInvitePanel api={inAppApi} className="mb-3" />}
            <h3 className="mb-1 text-[12px] font-bold text-ink">
              リンクで招待 <span className="font-normal text-muted">（アプリを使っていない人向け）</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleIssue()}
                disabled={busy !== null}
                className="h-9 rounded-[8px] bg-ink px-3 text-[12px] font-semibold text-on-ink disabled:opacity-45"
              >
                {busy === "issue" ? "発行中…" : "リンクを発行（7日間有効）"}
              </button>
            </div>
            {issuedPath && (
              <div className="mt-2 rounded-[8px] bg-tint p-2.5 text-[12px] text-ink">
                <p className="mb-1 text-[11px] text-muted">このリンクを共有してください（再表示はできません）</p>
                <code className="break-all" data-invitation-url>{`${origin}${issuedPath}`}</code>
              </div>
            )}
            {invitations.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center gap-2 text-[11px] text-muted">
                    <span>{ALBUM_ROLE_LABELS[invitation.role as InvitableRole] ?? invitation.role}</span>
                    <span>期限 {new Date(invitation.expiresAt).toLocaleDateString("ja-JP")}</span>
                    <span className="ml-auto">
                      {invitation.status === "valid" ? (
                        <button
                          type="button"
                          onClick={() => void handleRevoke(invitation.id)}
                          disabled={busy !== null}
                          className="font-medium text-accent underline underline-offset-2 disabled:opacity-45"
                        >
                          {busy === `revoke:${invitation.id}` ? "無効化しています…" : "無効化"}
                        </button>
                      ) : invitation.status === "revoked" ? (
                        "無効化済み"
                      ) : (
                        "期限切れ"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="posts-heading" className="flex flex-col gap-3">
          <h2 id="posts-heading" className="text-[13px] font-bold text-ink">投稿</h2>
          {album.posts.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted">まだ投稿がありません</p>
          ) : (
            album.posts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-[12px] border border-line bg-surface" data-album-post={post.id}>
                {post.thumbnailUrl && (
                  <MediaGrid
                    items={[
                      {
                        id: `${post.id}-cover`,
                        mediaType: post.thumbnailMediaType ?? "photo",
                        thumbnailUrl: post.thumbnailUrl,
                        alt: `${post.spotName}の${post.thumbnailMediaType === "video" ? "動画" : "写真"}`,
                      },
                    ]}
                  />
                )}
                <Link href={`/posts/${post.id}?back=${encodeURIComponent(`/albums/${album.tripId}`)}`} prefetch={false} className="flex flex-col gap-1 p-3">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    {post.spotName}
                    {post.visibility === "private" && (
                      <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-medium text-ink">非公開</span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted">
                    {post.category}
                    {post.duration && ` ・ ${post.duration}`}
                    {formatCost(post.cost) && ` ・ ${formatCost(post.cost)}`}
                    {post.mediaCount > 1 && ` ・ ${post.mediaCount}点`}
                  </span>
                  <span className="text-[11px] text-muted">
                    {post.author.displayName} ・ {new Date(post.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </Link>
              </article>
            ))
          )}
        </section>

        <div className="flex justify-end">
          <ReportLink targetType="trip" targetId={album.tripId} returnTo={`/albums/${album.tripId}`} />
        </div>
      </div>
    </div>
  );
}

const defaultApi: AlbumApi = {
  deleteAlbum: (tripId) => fetchWithAuthRedirect(`/api/trips/${tripId}`, { method: "DELETE" }),
  rename: (tripId, title) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  issueInvitation: (tripId, role) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  revokeInvitation: (tripId, invitationId) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}/invitations/${invitationId}`, { method: "DELETE" }),
  fetchInviteCandidates: async (tripId) => {
    const response = await fetchWithAuthRedirect(`/api/trips/${tripId}/invite-candidates`);
    if (!response.ok) throw new Error(`Failed to fetch candidates: ${response.status}`);
    return (await response.json()) as { candidates: InviteCandidate[] };
  },
  searchUsers: searchUsersRequest,
  sendInvitation: (tripId, inviteeUserId, role) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, inviteeUserId }),
    }),
  changeRole: (tripId, userId, role) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  removeMember: (tripId, userId) =>
    fetchWithAuthRedirect(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" }),
  leave: (tripId) => fetchWithAuthRedirect(`/api/trips/${tripId}/members/me`, { method: "DELETE" }),
};
