"use client";

import { useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { WishlistItem } from "@/lib/wishlist/constants";

/**
 * F-RC-05 Task2: 「行きたい」スポット一覧画面（SC-08）
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 *
 * 初期一覧は Server Component（/wishlist）が getWishlistItems で取得して渡す。
 * 投稿が無いスポットは thumbnailUrl がプレースホルダになっている（resolveWishlistThumbnail）。
 * 一覧からの取消（E2Eシナリオ3）はここで行い、成功したら行を消す。
 */
export function WishlistScreen({
  initialItems,
  submitRemove = defaultSubmitRemove,
}: {
  initialItems: WishlistItem[];
  /** 差し替え口（単体テスト用） */
  submitRemove?: (spotId: string) => Promise<Response>;
}) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRemove = async (spotId: string) => {
    if (pendingId) return;
    setPendingId(spotId);
    setErrorMessage(null);

    try {
      const response = await submitRemove(spotId);
      if (!response.ok) {
        setErrorMessage("保存を解除できませんでした");
        return;
      }
      setItems((current) => current.filter((item) => item.spotId !== spotId));
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("保存を解除できませんでした");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 bg-[#FBF6F0] px-6 py-12">
      <h1 className="text-[16px] font-bold text-[#3D3A35]">行きたいスポット</h1>

      <div className="w-full max-w-[420px]">
        {items.length === 0 ? (
          <p className="text-center text-[13px] text-[#9C9488]">
            まだ「行きたい」スポットはありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li
                key={item.spotId}
                className="flex items-center gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl}
                  alt={item.hasPost ? `${item.name}の写真` : "投稿がないスポット"}
                  data-placeholder={item.hasPost ? undefined : "true"}
                  className="h-16 w-16 shrink-0 rounded-[8px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#3D3A35]">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#9C9488]">
                    {item.prefecture ?? "都道府県未設定"}
                    {!item.hasPost && " ・ 投稿なし"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.spotId)}
                  disabled={pendingId !== null}
                  aria-label={`${item.name}の保存を解除`}
                  className="shrink-0 text-[12px] font-medium text-[#C4703F] underline underline-offset-2 disabled:opacity-45"
                >
                  {pendingId === item.spotId ? "解除中..." : "解除"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorMessage && <ErrorNotice className="mt-3" message={errorMessage} />}
      </div>
    </div>
  );
}

function defaultSubmitRemove(spotId: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" });
}
