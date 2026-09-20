"use client";

import Link from "next/link";
import { GoogleMap } from "./GoogleMap";

/**
 * mentoring-7 Task4（v3.1）: 上 1/3 の「見るだけの地図」（スポット別一覧・投稿詳細）
 * 出典: docs/tasks/shared-ui/mentoring-7/04-map-on-top.md
 *       要件定義書 v3.1 3.4.2「スポット別の構成」・3.5.1「構成」
 *
 * 【初心者向け】そのスポットのピン 1 本だけを置いた地図。ドラッグもズームもできない（GoogleMap の interactive=false）。
 * 全体をリンクで覆っているので、どこをタップしても全画面の地図（SC-02。`href`）へ移る。
 * 「地図で見る」ボタンはこの地図が兼ねるので置かない。
 */
export function StaticSpotMap({ spot, href, className }: { spot: { id: string; name: string; lat: number; lng: number }; href: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} data-static-spot-map>
      <GoogleMap
        initialCenter={{ lat: spot.lat, lng: spot.lng }}
        initialZoom={15}
        pins={[{ id: spot.id, lat: spot.lat, lng: spot.lng, type: "focus", title: spot.name }]}
        cluster={false}
        interactive={false}
        className="h-full w-full"
      />
      <Link href={href} aria-label={`${spot.name}を地図で見る`} className="absolute inset-0 z-10 block">
        <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-on-ink">タップで地図を全画面に</span>
      </Link>
    </div>
  );
}
