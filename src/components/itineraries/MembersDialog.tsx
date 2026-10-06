"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryMember } from "@/lib/itineraries/get-itinerary";
import { ITINERARY_ROLE_LABELS, type ItineraryRole } from "@/lib/itineraries/membership";
import type { ItineraryApi } from "./itinerary-api";
import { useConfirm } from "@/components/ui/ConfirmSheet";

/**
 * itinerary-sharing Task2: 「メンバー」ダイアログ（一覧・削除・退出）
 * 出典: docs/tasks/itinerary/itinerary-sharing/02-members-and-notifications.md
 *
 * 【初心者向け】オーナーには他のメンバーの「削除」、メンバーには自分の「退出」を出す。
 * 退出したらしおり一覧へ戻る（もう見られないため）。
 */
export function MembersDialog({
  open,
  itineraryId,
  members: initialMembers,
  viewerId,
  role,
  onClose,
  api,
}: {
  open: boolean;
  itineraryId: string;
  members: ItineraryMember[];
  viewerId: string;
  role: ItineraryRole;
  onClose: () => void;
  api: ItineraryApi;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(null);
  /*
   * loading-feedback Task 4-7（2026-10-02）: いま押しているボタンの目印。
   *
   * 【初心者向け】以前は真偽値 1 つだったので「何かやっている」までは分かっても
   * **どのボタンを押したのか**が分からず、文言を変えられなかった（メンバーが複数いると
   * どの「削除」が動いているのか見えない）。目印を持たせて、押した 1 つだけ文言を変える。
   */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // #778: 確認はブラウザ標準の箱ではなく、アプリ共通のシートで聞く
  const { confirm, confirmSheet } = useConfirm();
  const busy = busyKey !== null;

  const remove = async (userId: string) => {
    if (busy) return;
    if (!(await confirm({ title: "このメンバーをしおりから外しますか？", confirmLabel: "外す", danger: true }))) return;
    setBusyKey(`remove:${userId}`);
    setError(null);
    try {
      const response = await api.removeMember(itineraryId, userId);
      if (!response.ok) {
        setError("メンバーを外せませんでした");
        return;
      }
      setMembers((current) => current.filter((member) => member.userId !== userId));
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("メンバーを外せませんでした");
    } finally {
      setBusyKey(null);
    }
  };

  const leave = async () => {
    if (busy) return;
    if (!(await confirm({ title: "このしおりから退出しますか？", description: "もう一度招待されれば戻れます。", confirmLabel: "退出", danger: true }))) return;
    setBusyKey("leave");
    setError(null);
    try {
      const response = await api.leave(itineraryId);
      if (!response.ok) {
        setError("退出できませんでした");
        return;
      }
      router.push("/itineraries");
      router.refresh();
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("退出できませんでした");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Sheet open={open} title="メンバー" onClose={onClose}>
      {confirmSheet}
      <div className="flex flex-col gap-3" data-members-dialog>
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2 rounded-[8px] border border-line px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
                {member.displayName}
                {member.userId === viewerId && <span className="ml-1 text-[0.6875rem] text-muted">（自分）</span>}
              </span>
              <span className="text-[0.6875rem] text-muted">{ITINERARY_ROLE_LABELS[member.role]}</span>
              {role === "owner" && member.role !== "owner" && (
                <button type="button" onClick={() => void remove(member.userId)} disabled={busy} className="text-[0.75rem] font-medium text-saved underline underline-offset-2 disabled:opacity-45">
                  {busyKey === `remove:${member.userId}` ? "削除中…" : "削除"}
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <ErrorNotice message={error} />}
        {role === "member" && (
          <button type="button" onClick={() => void leave()} disabled={busy} className="h-10 rounded-[10px] border border-line bg-surface text-[0.8125rem] font-semibold text-saved disabled:opacity-45">
            {busyKey === "leave" ? "退出しています…" : "このしおりから退出"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
