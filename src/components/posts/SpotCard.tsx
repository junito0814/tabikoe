"use client";

import Link from "next/link";
import { SaveButton } from "@/components/save/SaveButton";
import { appendBackHref } from "@/lib/search/list-state";
import { formatStatusLabel } from "@/lib/spots/format-status-label";
import type { SpotCardData } from "@/lib/spots/search-spots";
import type { AddModeInfo } from "./AddModeBanner";

/**
 * mentoring-7 Task3（v3.1）: スポットカード（検索結果の 1 件分）
 * 出典: docs/tasks/shared-ui/mentoring-7/03-spot-cards.md
 *       要件定義書 v3.1 3.4.2「スポットカードの必須表示」
 *       wireframes.md「検索結果（行き先：大阪府）— スポットカードの縦一列」
 *
 * 【初心者向け】検索結果はスポットごとに 1 枚。同じスポットの投稿が何件あっても 1 枚にまとまる。
 *   - 上段: スポット名、都道府県（#680 でラベル、#692 で徒歩を外した）
 *   - 中段: 代表写真（最新の投稿の 1 枚目）、★の平均・投稿件数・最新の感想 1 行
 *   - 下段: まだあった、「＋」（保存先シート。追加モードなら直接追加）
 * カード本体のタップでスポット別の投稿一覧（/search?spot=）へ。SaveButton だけはリンクの外に置く（押しても遷移しない）。
 * Bug #469: 今の検索結果の URL を `back=` で渡し、スポット別一覧の戻るが検索結果（「← 東京都」）になるようにする。
 */
export function SpotCard({ spot, addMode = null, backHref = null }: { spot: SpotCardData; addMode?: AddModeInfo | null; /** 今の検索結果の URL（戻り先） */ backHref?: string | null }) {
  const statusLabel = formatStatusLabel(spot.latestStatus);
  const href = appendBackHref(`/search?spot=${spot.id}`, backHref);

  return (
    <article className="relative flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 shadow-card" data-spot-card={spot.id}>
      {/*
        ~~performance Task1: 一覧のカードは先読みしない（1 画面で何十本も裏で走り、関所と Supabase を叩くため）~~
        → **2026-10-09 に取り消し（#900）。**

        【初心者向け】先読みを切ると、押した**その瞬間に初めて**サーバーへ行くことになる。
        本番で測ると、冷えた関数が立ち上がるのに **2.44 秒**かかっていた（温まっていれば 0.21 秒）。
        利用者にはこれが「押しても 2 秒待たされる」として出ていた。

        既定（`prefetch` を書かない）に戻すと、動的な画面では「**`loading.tsx` の手前まで**」だけを
        先読みする（同梱ドキュメント: node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md）。
        **データ全部は取りに行かない**ので、切った当時に心配した重さにはならない。
        関所（proxy.ts）も先読みの要求を見分けて軽く済ませている。
      */}
      <Link href={href} className="flex flex-col gap-2">
        <h3 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pr-10 text-[0.9375rem] font-bold leading-tight text-ink">
          <span className="min-w-0 truncate">{spot.name}</span>
        </h3>
        {/* #692: 「徒歩 N 分」は外した（位置情報の許可と取得を待つぶん、一覧が遅れていた） */}
        <p className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted">
          {spot.prefecture && <span>{spot.prefecture}</span>}
        </p>

        <div className="flex gap-3">
          <span className="block h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[10px] bg-tint">
            {spot.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.coverUrl} alt="" className="h-full w-full object-cover" />
            )}
            {spot.coverMediaType === "video" && (
              <span aria-hidden className="pointer-events-none relative -mt-[92px] flex h-[92px] items-center justify-center text-white">
                ▶
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-x-2.5 text-[0.75rem] text-muted">
              {spot.averageRating !== null ? (
                <span className="flex items-center gap-1" aria-label={`星${spot.averageRating}`}>
                  <span className="text-[0.8125rem] text-star" aria-hidden>
                    ★
                  </span>
                  <span>{spot.averageRating.toFixed(1)}</span>
                </span>
              ) : (
                <span>評価なし</span>
              )}
              <span data-post-count>投稿 {spot.postCount} 件</span>
            </p>
            {spot.latestComment && <p className="line-clamp-2 text-[0.8125rem] leading-[1.6] text-ink">{spot.latestComment}</p>}
            {statusLabel && (
              <p className="text-[0.75rem] font-medium text-done" data-spot-status>
                {statusLabel}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="absolute top-2 right-2">
        <SaveButton
          spotId={spot.id}
          initialSaved={spot.viewerHasSaved}
          size="sm"
          addMode={addMode ? { itineraryId: addMode.itineraryId, day: addMode.day, initialAdded: addMode.spotIds.includes(spot.id) } : null}
        />
      </div>
    </article>
  );
}
