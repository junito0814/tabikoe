import { BackLink } from "@/components/layout/BackLink";
import type { BadgeStatus } from "@/lib/badges/badge-status";
import type { BadgeCategory } from "@/lib/badges/catalog";

/**
 * F-BG Task4: ステータスバッジ画面（SC-10）
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md
 *
 * カタログの全バッジを種別ごとに並べ、獲得済みは獲得日つきで強調、未獲得はグレーアウトする。
 * 都道府県は未投稿の県も含めて47都道府県すべてを出す。
 * 表示のみで操作は無いため Server Component。
 */
const SECTIONS: { category: BadgeCategory; title: string; note: string }[] = [
  { category: "post_count", title: "投稿数バッジ", note: "累計投稿数 1／10／50／100件" },
  { category: "like_count", title: "いいね数バッジ", note: "累計獲得いいね数 1／10／50／100／200件" },
  // v3.2（feedback-0919 Task2）
  { category: "spot_registration", title: "スポット登録バッジ", note: "「タビコエだけの場所」を最初に登録した件数 1／3／5／10／20／30／50件" },
  { category: "prefecture", title: "都道府県バッジ", note: "各都道府県で1件以上投稿" },
];

function formatAcquiredAt(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

export function BadgeScreen({ badges }: { badges: BadgeStatus[] }) {
  const acquiredCount = badges.filter((badge) => badge.acquiredAt !== null).length;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-app px-6 pb-12 pt-6">
      {/* #686: ホーム画面から単独で開くとブラウザの戻るが無いので、左上に戻るを置く */}
      <div className="flex w-full max-w-[420px] items-center">
        <BackLink />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[16px] font-bold text-ink">ステータスバッジ</h1>
        <p className="text-[12px] text-muted">
          {acquiredCount} / {badges.length} 個を獲得
        </p>
      </div>

      {SECTIONS.map((section) => {
        const items = badges.filter((badge) => badge.category === section.category);
        return (
          <section key={section.category} className="w-full max-w-[420px]">
            <h2 className="text-[13px] font-bold text-ink">{section.title}</h2>
            <p className="mb-2.5 text-[11px] text-muted">{section.note}</p>
            <ul
              className={
                section.category === "prefecture"
                  ? "grid grid-cols-3 gap-2"
                  : "grid grid-cols-2 gap-2"
              }
            >
              {items.map((badge) => {
                const acquired = badge.acquiredAt !== null;
                return (
                  <li
                    key={badge.type}
                    data-acquired={acquired ? "true" : "false"}
                    aria-label={`${badge.label}（${acquired ? "獲得済み" : "未獲得"}）`}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2 py-2.5 text-center ${
                      acquired
                        ? "border-accent/40 bg-surface text-ink shadow-[0_2px_10px_rgba(196,112,63,0.12)]"
                        : "border-line bg-tint text-muted opacity-70"
                    }`}
                  >
                    <span aria-hidden className={`text-[16px] ${acquired ? "" : "grayscale opacity-50"}`}>
                      🏅
                    </span>
                    <span className="text-[12px] font-semibold leading-tight">{badge.label}</span>
                    <span className="text-[10px] leading-tight">
                      {acquired ? formatAcquiredAt(badge.acquiredAt!) : "未獲得"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
