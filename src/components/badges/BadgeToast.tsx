"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloseButton } from "@/components/ui/CloseButton";
import { findBadgeDefinition } from "@/lib/badges/catalog";
import { prefectureMotif } from "@/lib/badges/prefecture-motifs";
import { appendBackHref } from "@/lib/search/list-state";
import { PrefectureBadgeIcon } from "./PrefectureBadgeIcon";

/** 自動で閉じるまでの時間。複数件をまとめて1枚に出すので少し長め */
const AUTO_DISMISS_MS = 6000;

/**
 * F-BG Task5: バッジ新規獲得時のトースト
 * 出典: docs/tasks/badges/status-badges/05-badge-toast-notification.md
 *
 * 新規獲得が0件なら何も描画しない。複数件は1枚のトーストにまとめて全件表示する（獲得判定順）。
 * 通知一覧には残らない（3.9）。表示のみで、閉じても再表示されない。
 */
export function BadgeToast({
  badgeTypes,
  autoDismissMs = AUTO_DISMISS_MS,
  backHref,
}: {
  badgeTypes: string[];
  /** 0以下で自動クローズしない（テスト用） */
  autoDismissMs?: number;
  /**
   * #972: この知らせが出ている画面の URL。「バッジ一覧を見る」の戻り先になる。
   *
   * 【初心者向け】ここは `?back=` を渡していなかったので、バッジ画面の戻るが
   * 既定の**マイページ**になり、**投稿した直後に喜んで押した人が、自分の新しい投稿に帰れなかった**。
   * 起きるのはバッジを取った直後だけだが、そこが見せ場なので直す。
   */
  backHref?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(badgeTypes.length > 0);

  useEffect(() => {
    if (!isOpen || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => setIsOpen(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoDismissMs]);

  const badges = badgeTypes
    .map((type) => findBadgeDefinition(type))
    .filter((badge) => badge !== undefined);

  if (!isOpen || badges.length === 0) return null;

  /*
   * #977: 絵を出すのは「都道府県バッジを 1 つだけ取った」ときに限る。
   * 絵を持っていない県（まだ決まっていない県）では null のままなので 🏅 に落ちる。
   */
  const sole = badges.length === 1 ? badges[0] : undefined;
  const soleMotifPrefecture =
    sole?.category === "prefecture" && prefectureMotif(sole.label) !== null ? sole.label : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className="flex w-full max-w-[360px] items-start gap-3 rounded-[12px] border border-accent/30 bg-surface px-4 py-3 shadow-card">
        {/*
          * #977: 取ったのが都道府県バッジ **1 つだけ**のときは、その県の絵を出す（要件 4.5.20）。
          *
          * 【初心者向け】複数まとめて取ったときは **🏅 のまま**にします ── どれか 1 つの絵を
          * 選ぶ理由が無く、「東京都のバッジだけ取った」と読み違えられるためです。
          * 大きさは **40px**（56px だと帯が縦に伸びます）。
          */}
        <span aria-hidden data-badge-icon className="mt-0.5">
          {soleMotifPrefecture ? (
            <PrefectureBadgeIcon prefecture={soleMotifPrefecture} size={40} />
          ) : (
            <span className="text-[1.125rem]">🏅</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-bold text-ink">
            {badges.length === 1 ? "バッジを獲得しました" : `${badges.length}個のバッジを獲得しました`}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <li
                key={badge.type}
                className="rounded-full bg-accent/[0.1] px-2.5 py-0.5 text-[0.75rem] font-medium text-accent"
              >
                {badge.label}
              </li>
            ))}
          </ul>
          <Link
            href={appendBackHref("/badges", backHref)}
            className="tap-target mt-1.5 inline-block text-[0.6875rem] font-medium text-muted underline underline-offset-2"
          >
            バッジ一覧を見る
          </Link>
        </div>
        {/* #712: 文字の × をやめ、形を共通部品に寄せた */}
        <CloseButton onClick={() => setIsOpen(false)} />
      </div>
    </div>
  );
}
