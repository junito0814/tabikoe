"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { AlbumSort } from "@/lib/albums/get-album";

/**
 * #715: アルバム一覧の「＋ 新規」と並び順
 * 出典: 要件定義書 3.6.2「アルバム」・ワイヤーフレーム決定事項 82
 *
 * 【初心者向け】一覧そのものは Server Component（`src/app/albums/page.tsx`）で、
 * ここだけが押せる部分。**名前ひとつでアルバムを作り、しおりは作らない。**
 * 作ったらそのアルバムの中へ入る（空の画面から招待もできる）。
 */
export function AlbumListControls({
  sort,
  createAlbum = defaultCreateAlbum,
}: {
  sort: AlbumSort;
  /** テストで差し替える */
  createAlbum?: (title: string) => Promise<string>;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const name = title.trim();
    if (name.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tripId = await createAlbum(name);
      setIsOpen(false);
      setTitle("");
      router.push(`/albums/${tripId}`);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("アルバムを作れませんでした。時間をおいてお試しください");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="sr-only">並び順</span>
          <select
            value={sort}
            onChange={(event) => router.replace(`/albums?sort=${event.target.value}`)}
            aria-label="並び順"
            className="h-8 rounded-full border border-line bg-surface px-2 text-[12px] font-semibold text-ink"
          >
            <option value="newest">新着順</option>
            <option value="oldest">古い順</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-9 rounded-full bg-accent px-4 text-[12px] font-bold text-white"
        >
          ＋ 新規
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="album-create-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => setIsOpen(false)}
        >
          <div className="w-full max-w-[360px] rounded-[14px] bg-surface p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <h2 id="album-create-title" className="flex-1 text-[14px] font-bold text-ink">
                アルバムを作る
              </h2>
              {/* 要件 4.5.13: 重ねて出したものを閉じる × は右上 */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="閉じる"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例: 沖縄 2026 夏"
              aria-label="アルバムの名前"
              autoFocus
              className="mb-2 h-10 w-full rounded-[10px] border border-line bg-app px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mb-3 text-[11px] leading-[1.7] text-muted">しおり（旅の計画）は作られません。あとから作れます。</p>
            {error && <p role="alert" className="mb-2 text-[11px] text-saved">{error}</p>}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={title.trim().length === 0 || busy}
              className="h-10 w-full rounded-[10px] bg-accent text-[13px] font-bold text-white disabled:opacity-45"
            >
              {busy ? "作っています…" : "作る"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

async function defaultCreateAlbum(title: string): Promise<string> {
  const response = await fetchWithAuthRedirect("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("create_failed");
  const data = (await response.json()) as { tripId: string };
  return data.tripId;
}
