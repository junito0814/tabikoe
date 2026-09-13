"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { ALBUM_ROLE_LABELS, type InvitableRole } from "@/lib/albums/membership";

/**
 * F-RC-03 Task4: 招待リンクを開いた画面
 * 出典: docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md
 *
 * 未ログイン時は Server Component 側（/invitations/[token]）がログイン画面へ誘導し、
 * ログイン後にこの画面へ戻る。受諾ボタンで POST /api/invitations/[token]/accept を呼ぶ。
 */
export function InvitationAcceptScreen({
  token,
  invitation,
  submitAccept = defaultSubmitAccept,
}: {
  token: string;
  invitation:
    | { status: "valid"; tripTitle: string; role: InvitableRole; alreadyMember: boolean }
    | { status: "expired" | "revoked" | "not_found" };
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
        setErrorMessage("アルバムに参加できませんでした");
        return;
      }
      const data = (await response.json()) as { tripId: string };
      router.push(`/albums/${data.tripId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("アルバムに参加できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBF6F0] px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-3 rounded-[14px] border border-[#E8E1D8] bg-white p-5">
        {invitation.status === "valid" ? (
          <>
            <h1 className="text-[16px] font-bold text-[#3D3A35]">アルバムへの招待</h1>
            <p className="text-[13px] leading-[1.7] text-[#3D3A35]">
              「{invitation.tripTitle}」に<strong>{ALBUM_ROLE_LABELS[invitation.role]}</strong>として招待されています。
            </p>
            {invitation.alreadyMember ? (
              <p className="text-[12px] text-[#9C9488]">すでにこのアルバムのメンバーです</p>
            ) : (
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={isSubmitting}
                className="h-11 rounded-[10px] bg-[#C4703F] text-[14px] font-semibold text-white disabled:opacity-45"
              >
                {isSubmitting ? "参加中…" : "アルバムに参加する"}
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[16px] font-bold text-[#3D3A35]">招待リンクが無効です</h1>
            <p className="text-[13px] leading-[1.7] text-[#9C9488]">
              {invitation.status === "expired"
                ? "有効期限（7日間）が切れています。オーナーに新しいリンクの発行を依頼してください。"
                : invitation.status === "revoked"
                  ? "このリンクはオーナーによって無効化されました。"
                  : "リンクが正しくありません。"}
            </p>
          </>
        )}
        {errorMessage && <ErrorNotice message={errorMessage} />}
        <Link href="/albums" className="text-center text-[12px] text-[#9C9488] underline underline-offset-2">
          アルバム一覧へ
        </Link>
      </div>
    </div>
  );
}

function defaultSubmitAccept(token: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
}
