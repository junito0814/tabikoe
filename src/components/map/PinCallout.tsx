"use client";

import Link from "next/link";
import type { MapPinData } from "@/lib/map/get-map-pins";
import { composeHref } from "@/lib/posts/compose-initial-state";
import { formatStatusLabel } from "@/lib/spots/format-status-label";

/**
 * pin-interaction-v3 Task1・Task3: ピンの吹き出し
 * 出典: docs/tasks/map-search/pin-interaction-v3/01-pin-callout.md
 *       docs/tasks/map-search/pin-interaction-v3/03-draft-pin-callout.md
 *       要件定義書 v3.0 3.4.4
 *
 * 【初心者向け】ピンの種別で中身が変わる。
 *   - post / saved: スポット名・星平均・投稿件数・最新の「まだあった」・「一覧」「投稿する」
 *   - draft       : 「下書き: 〈スポット名または名前のない場所〉 [続きを書く]」→ /posts/new?draft=<id>
 *   - 長押しの一時ピン（temp）: 「この地点 [ここに投稿]」→ /posts/new?lat&lng
 * 吹き出しの位置決め（地図のどこに出すか）は MapScreen が担当し、ここは中身だけ。
 */
export type CalloutTarget =
  | { kind: "pin"; pin: MapPinData }
  | { kind: "temp"; lat: number; lng: number };

export function PinCallout({ target, backHref, onClose }: { target: CalloutTarget; backHref?: string | null; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label={target.kind === "temp" ? "この地点" : target.pin.name}
      data-pin-callout={target.kind === "temp" ? "temp" : target.pin.kind}
      className="relative w-[min(260px,calc(100vw-48px))] rounded-[12px] border border-line bg-surface p-3 text-ink shadow-card"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {target.kind === "temp" ? (
        <TempBody lat={target.lat} lng={target.lng} />
      ) : target.pin.kind === "draft" ? (
        <DraftBody pin={target.pin} />
      ) : (
        <SpotBody pin={target.pin} backHref={backHref ?? null} />
      )}
      {/* 吹き出しのしっぽ */}
      <span aria-hidden className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1.5 rotate-45 border-b border-r border-line bg-surface" />
    </div>
  );
}

function SpotBody({ pin, backHref }: { pin: MapPinData; backHref: string | null }) {
  const statusLabel = formatStatusLabel(pin.latestStatus);
  const listHref = pin.spotId ? `/spots/${pin.spotId}` : "/search";
  return (
    <div className="flex flex-col gap-1.5 pr-5">
      <p className="truncate text-[14px] font-bold">{pin.name}</p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
        {pin.ratingAverage !== null && (
          <span>
            <span className="text-star" aria-hidden>
              ★
            </span>
            {pin.ratingAverage}
          </span>
        )}
        {pin.ratingAverage !== null && <span aria-hidden>・</span>}
        <span>{pin.postCount}件</span>
        {statusLabel && (
          <>
            <span aria-hidden>・</span>
            <span className="text-done">{statusLabel}</span>
          </>
        )}
      </p>
      <div className="mt-0.5 flex gap-2">
        <Link href={listHref} className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-line bg-surface text-[12px] font-semibold">
          一覧
        </Link>
        {pin.spotId && (
          <Link
            href={composeHref({ kind: "spot", spotId: pin.spotId })}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white"
          >
            投稿する
          </Link>
        )}
      </div>
      {backHref && <span className="sr-only">戻り先: {backHref}</span>}
    </div>
  );
}

function DraftBody({ pin }: { pin: MapPinData }) {
  return (
    <div className="flex flex-col gap-1.5 pr-5">
      <p className="truncate text-[13px]">
        <span className="mr-1 rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-muted">下書き</span>
        <span className="font-bold">{pin.name}</span>
      </p>
      <Link
        href={composeHref({ kind: "draft", draftId: pin.draftId ?? "" })}
        className="inline-flex h-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white"
      >
        続きを書く
      </Link>
    </div>
  );
}

function TempBody({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="flex flex-col gap-1.5 pr-5">
      <p className="text-[13px] font-bold">この地点</p>
      <Link
        href={composeHref({ kind: "location", lat, lng })}
        className="inline-flex h-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white"
      >
        ここに投稿
      </Link>
    </div>
  );
}
