import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin/dashboard";

/**
 * admin-shell-dashboard Task 2: ダッシュボード（SC-16）の表示
 * 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
 *       docs/wireframes.md「SC-16 ダッシュボード」、見た目: https://claude.ai/artifact/KoY91teZdaTPQahdk2LEhM
 *
 * 【初心者向け】数字を集めるのは lib/admin/dashboard.ts（サーバー）。ここは受け取ったものを並べるだけで、
 * 状態も通信も持たない（"use client" が要らない）。上段の帯は 0 件でも消さず緑で「ありません」と出す
 * （帯が消えると「無い」のか「壊れている」のか分からないため）。「見る」は利用者向けの画面を新しいタブで開く。
 */
export function AdminDashboardScreen({ data }: { data: AdminDashboardData }) {
  const { needsAction, counts } = data;
  return (
    <div className="flex w-full flex-col gap-5">
      {/* 上段: 対応が要るもの */}
      <section aria-label="対応が要るもの" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <AlertCard
          count={needsAction.openReports.count}
          unit="件"
          label="未対応の通報"
          sub={needsAction.openReports.oldestDays !== null ? `いちばん古いもの ${needsAction.openReports.oldestDays} 日前` : null}
          href="/admin/reports?status=open&sort=oldest"
          action="対応"
        />
        <AlertCard count={needsAction.autoHiddenPending} unit="件" label="自動で非公開・確認待ち" href="/admin/hidden" action="確認" />
        <AlertCard count={needsAction.provisionalSuspensions} unit="人" label="仮停止の確認待ち" href="/admin/users?status=provisional" action="確認" />
      </section>

      {/* 中段: 数字 */}
      <section aria-label="数字" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="利用者" value={`${counts.users.total} 人`} sub={`今週 +${counts.users.thisWeek}`} />
        <StatCard label="投稿" value={`${counts.posts.total} 件`} sub={`今週 +${counts.posts.thisWeek}`} />
        <StatCard label="スポット" value={`${counts.spots.total} 件`} sub={`うち ${counts.spots.manual} タビコエだけの場所`} />
        <StatCard
          label="使った人"
          value={counts.activeUsers ? `今日 ${counts.activeUsers.today}` : "—"}
          sub={counts.activeUsers ? `今週 ${counts.activeUsers.thisWeek}` : "最終利用日の記録（#547）の後に出ます"}
        />
      </section>

      {/* 下段: 最近の動き */}
      <section aria-label="最近の動き" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="最近の投稿">
          {data.recentPosts.length === 0 ? (
            <Empty />
          ) : (
            <table className="w-full text-[12px]">
              <tbody>
                {data.recentPosts.map((post) => (
                  <tr key={post.id} className="border-b border-line last:border-b-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{relativeTime(post.publishedAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-ink">{post.spotName}</span>
                      <span className="ml-1 text-muted">／ {post.authorName}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{post.category}</td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${post.isPublic ? "bg-tint text-accent" : "border border-line text-muted"}`}>
                        {post.isPublic ? "公開" : "非公開"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <ExternalLink href={`/posts/${post.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title="通報が集中している対象">
            {data.concentratedTargets.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {data.concentratedTargets.map((t) => (
                    <tr key={`${t.targetType}:${t.targetId}`} className="border-b border-line last:border-b-0">
                      <td className="py-2 pr-3 font-semibold text-ink">{t.label}</td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-ink">{t.reporterCount} 人</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-muted">{relativeTime(t.latestAt)}</td>
                      <td className="py-2 text-right">
                        <Link href={t.href} className="text-[12px] text-accent underline underline-offset-2">
                          開く
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="最近のスポット">
            {data.recentSpots.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {data.recentSpots.map((spot) => (
                    <tr key={spot.id} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-muted">{relativeTime(spot.createdAt)}</td>
                      <td className="py-2 pr-3 font-semibold text-ink">{spot.name}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-muted">{spot.prefecture ?? "—"}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        {spot.isManual && <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted">だけ</span>}
                      </td>
                      <td className="py-2 text-right">
                        <ExternalLink href={`/spots/${spot.id}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

function AlertCard({ count, unit, label, sub, href, action }: { count: number; unit: string; label: string; sub?: string | null; href: string; action: string }) {
  const none = count === 0;
  return (
    <div
      data-alert={none ? "none" : "some"}
      className={`flex items-center justify-between gap-3 rounded-[12px] border p-4 ${
        none ? "border-done/40 bg-done/10" : "border-saved/40 bg-saved/10"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[12px] text-muted">{label}</p>
        <p className={`text-[20px] font-bold ${none ? "text-done" : "text-saved"}`}>
          {none ? "ありません" : `${count} ${unit}`}
        </p>
        {!none && sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
      {!none && (
        <Link href={href} className="shrink-0 rounded-[8px] bg-ink px-3 py-2 text-[12px] font-semibold text-on-ink">
          {action} →
        </Link>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[20px] font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-line bg-surface p-4">
      <h2 className="mb-2 text-[13px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-4 text-center text-[12px] text-muted">ありません</p>;
}

/** 利用者向けの画面を新しいタブで開く */
function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[12px] text-accent underline underline-offset-2">
      見る ↗
    </a>
  );
}

/** 「2時間前」「昨日」「9/14」（純粋。テストは now を渡す） */
export function relativeTime(iso: string, now: Date = new Date()): string {
  if (!iso) return "—";
  const diff = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
