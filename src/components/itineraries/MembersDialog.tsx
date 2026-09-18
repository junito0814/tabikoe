"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryMember } from "@/lib/itineraries/get-itinerary";
import { ITINERARY_ROLE_LABELS, type ItineraryRole } from "@/lib/itineraries/membership";
import type { ItineraryApi } from "./itinerary-api";

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
  const [busy, setBusy] = useState(false);

  const remove = async (userId: string) => {
    if (busy || !window.confirm("このメンバーをしおりから外しますか？")) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy || !window.confirm("このしおりから退出しますか？")) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="メンバー" onClose={onClose}>
      <div className="flex flex-col gap-3" data-members-dialog>
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2 rounded-[8px] border border-line px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                {member.displayName}
                {member.userId === viewerId && <span className="ml-1 text-[11px] text-muted">（自分）</span>}
              </span>
              <span className="text-[11px] text-muted">{ITINERARY_ROLE_LABELS[member.role]}</span>
              {role === "owner" && member.role !== "owner" && (
                <button type="button" onClick={() => void remove(member.userId)} disabled={busy} className="text-[12px] font-medium text-saved underline underline-offset-2 disabled:opacity-45">
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <ErrorNotice message={error} />}
        {role === "member" && (
          <button type="button" onClick={() => void leave()} disabled={busy} className="h-10 rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-saved disabled:opacity-45">
            このしおりから退出
          </button>
        )}
      </div>
    </Sheet>
  );
}
