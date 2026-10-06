"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * itinerary-sharing Task1: しおりの招待リンクを開いた画面（アルバムの InvitationAcceptScreen と同型）
 * 出典: docs/tasks/itinerary/itinerary-sharing/01-invitation-links.md
 *
 * 受諾ボタンで POST /api/itinerary-invitations/[token]/accept を呼び、しおり詳細へ。
 */
export function ItineraryInvitationAcceptScreen({
  token,
  invitation,
  submitAccept = defaultSubmitAccept,
}: {
  token: string;
  invitation: { status: "valid"; title: string; itineraryId: string; alreadyMember: boolean } | { status: "expired" | "revoked" | "not_found" };
  /** 差し替え口（単体テスト用） */
  submitAccept?: (token: string) => Promise<Response>;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitAccept(token);
      if (response.status === 410) {
        setErrorMessage("この招待リンクは無効になっています");
        return;
      }
      if (!response.ok) {
        setErrorMessage("しおりに参加できませんでした");
        return;
      }
      const data = (await response.json()) as { itineraryId: string };
      router.push(`/itineraries/${data.itineraryId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("しおりに参加できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
        {invitation.status === "valid" ? (
          <>
            <h1 className="text-[1rem] font-bold text-ink">しおりへの招待</h1>
            <p className="text-[0.8125rem] leading-[1.7] text-ink">「{invitation.title}」のしおりに招待されています。参加するとスポットの追加・Day・時刻・メモ・チェックができます。</p>
            {invitation.alreadyMember ? (
              <Link href={`/itineraries/${invitation.itineraryId}`} className="text-center text-[0.8125rem] font-semibold text-accent underline underline-offset-2">
                すでにメンバーです。しおりを開く
              </Link>
            ) : (
              <button type="button" onClick={() => void handleAccept()} disabled={isSubmitting} className="h-11 rounded-[10px] bg-accent text-[0.875rem] font-semibold text-white disabled:opacity-45">
                {isSubmitting ? "参加中…" : "しおりに参加する"}
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[1rem] font-bold text-ink">招待リンクが無効です</h1>
            <p className="text-[0.8125rem] leading-[1.7] text-muted">
              {invitation.status === "expired"
                ? "有効期限（7日間）が切れています。オーナーに新しいリンクの発行を依頼してください。"
                : invitation.status === "revoked"
                  ? "このリンクはオーナーによって取り消されました。"
                  : "リンクが正しくありません。"}
            </p>
          </>
        )}
        {errorMessage && <ErrorNotice message={errorMessage} />}
        <Link href="/itineraries" className="text-center text-[0.75rem] text-muted underline underline-offset-2">
          計画へ
        </Link>
      </div>
    </div>
  );
}

function defaultSubmitAccept(token: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/itinerary-invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
}
