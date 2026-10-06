import Link from "next/link";
import type { MyPageSummary } from "@/lib/users/my-page";
import { MyPageMenu } from "./MyPageMenu";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { PostFab } from "@/components/posts/PostFab";

export interface MyPageProfile {
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
}

/**
 * F-RC-01 Task1〜4 / my-page-v3 Task1（v3.0）: マイページ（SC-06）
 * 出典: docs/tasks/records/my-page/01-my-page-layout.md
 *       docs/tasks/records/my-page-v3/01-drafts-section-and-menu.md
 *       要件定義書 v3.0 3.6.1（プロフィール → 下書き（あるときだけ）→ サマリー → 遷移メニュー 4 つ → 自分の投稿一覧）
 *
 * 管理者（is_admin）への導線は 4.2 に従いメニューバーではなくプロフィール側に置く。
 * 投稿数（summary.postCount）は公開済みだけを数え、下書きは含まない（lib/users/my-page.ts）。
 */
export function MyPageScreen({
  profile,
  summary,
  wishlistCount,
  badgeCount = 0,
}: {
  profile: MyPageProfile;
  summary: MyPageSummary;
  wishlistCount?: number;
  /** #683: 獲得済みのバッジの数（分母はカタログから出す） */
  badgeCount?: number;
}) {
  return (
    <PullToRefresh>
      {/* #807: 右下の「＋ ここに投稿」に最後の行が隠れないよう、下に 80px の余白（pb-24） */}
      <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-6 pb-24">
        <div className="flex w-full max-w-[520px] flex-col gap-5">
          {/*
            * #684: 投稿禁止中の帯は廃止した（決定事項 72）。
            * 制限は通知で伝え、投稿画面にも「◯/◯ まで投稿できません」が出る。
            */}
          {/*
            * 1. プロフィール（#683）
            *
            * 【初心者向け】**アイコンと名前のどちらを押しても編集へ**行く（決定事項 72）。
            * 「プロフィールを編集」というリンクは置かない ── 押せると分かるように
            * 名前の右に「›」を出す（押せるものに別のリンクを足さない、という考え方）。
            */}
          <section aria-label="プロフィール" className="rounded-[12px] border border-line bg-surface">
            <Link href="/account" className="flex items-center gap-3 p-4" aria-label={`${profile.displayName}（プロフィールを編集）`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatarUrl} alt={`${profile.displayName}のアイコン画像`} className="h-16 w-16 rounded-full object-cover" />
              <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">{profile.displayName}</h1>
              <span aria-hidden className="shrink-0 text-muted">
                ›
              </span>
            </Link>
            {profile.isAdmin && (
              <div className="border-t border-line px-4 py-2 text-[12px]">
                <Link href="/admin" className="font-medium text-muted underline underline-offset-2">
                  管理者ダッシュボード
                </Link>
              </div>
            )}
          </section>

          {/*
            * #683: ステータスバッジは「◯/63」の 1 行だけ（決定事項 72）。
            * 分母はカタログの件数から出す（数え間違いを防ぐ）。0 個でも出す。
            */}
          <Link
            href="/badges"
            className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] font-semibold text-ink"
            data-badge-line
          >
            <span aria-hidden>🏅</span>
            <span className="flex-1">ステータスバッジ</span>
            <span className="text-muted">
              {badgeCount} / {BADGE_CATALOG.length}
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>

          {/* #682: 下書きと自分の投稿一覧は「投稿履歴」（SC-12）へ移した */}

          {/* 2. サマリー */}
          <section aria-label="サマリー" className="grid grid-cols-2 gap-2">
            <div className="rounded-[12px] border border-line bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">投稿数</p>
              <p className="text-[20px] font-bold text-ink" data-summary="postCount">{summary.postCount}</p>
            </div>
            <div className="rounded-[12px] border border-line bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">獲得いいね</p>
              <p className="text-[20px] font-bold text-ink" data-summary="receivedLikeCount">{summary.receivedLikeCount}</p>
            </div>
          </section>

          {/* 3. 遷移メニュー */}
          <MyPageMenu wishlistCount={wishlistCount} />

        </div>
      </div>
      <PostFab />
    </PullToRefresh>
  );
}
