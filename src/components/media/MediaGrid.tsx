"use client";

import { useState } from "react";
import { FadeInImage } from "./FadeInImage";
import Link from "next/link";
import { MediaModal } from "./MediaModal";
import { PhotoMorph } from "@/components/transitions/Reveal";

/**
 * 写真・動画の表示レイアウト Task1〜3: MediaGrid共通コンポーネント
 * 出典: docs/tasks/shared-ui/media-layout/01-grid-layout-component.md
 *       docs/tasks/shared-ui/media-layout/02-overflow-count-badge.md
 *       docs/tasks/shared-ui/media-layout/03-video-thumbnail-inline-playback.md
 *
 * 投稿カード一覧・投稿詳細・スポット写真一覧など複数画面で共通利用する想定（7.6 保守性準拠）。
 * 1点目を常に代表画像とし、各レイアウトで最初に配置する。
 *
 * 【初心者向け】3 つの部品でできている。
 *   - MediaGrid: 点数（1／2／3／4 以上）でレイアウトを切り替える親。5 点目以降は 4 枠目に「+N」を重ねる
 *   - MediaCell: 1 枠。動画はクリックでその場再生（isPlaying）に切り替わる
 *   - MediaThumbnail: サムネイル画像＋動画なら再生アイコン。写真一覧（SC-13）でも単独で使う
 * v3.0（media-layout-v3 Task1）: 写真・動画のクリックで MediaModal（全画面の閲覧）を開く。動画はモーダル内で再生する。
 */
export interface MediaItem {
  id: string;
  mediaType: "photo" | "video";
  thumbnailUrl: string;
  /** 代替テキスト（要件定義書7.7：画像・動画サムネイルにalt属性を設定する） */
  alt: string;
  videoUrl?: string;
  /** モーダルで表示する大きい画像。無ければ thumbnailUrl を使う */
  fullUrl?: string;
}

function MediaCell({
  item,
  className,
  overflowCount,
  onOpen,
  href,
}: {
  item: MediaItem;
  className?: string;
  overflowCount?: number;
  onOpen: () => void;
  /** v3.1（mentoring-7 Task5）: 指定すると、タップでモーダルを開かずこのリンクへ移る（投稿カードの写真 → 投稿詳細） */
  href?: string;
}) {
  const inner = (
    <>
      <MediaThumbnail item={item} />

      {typeof overflowCount === "number" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[1.25rem] font-semibold text-white">
          +{overflowCount}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} prefetch={false} aria-label={item.alt} className={`relative block h-full w-full overflow-hidden bg-line ${className ?? ""}`}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={item.alt}
      className={`relative block h-full w-full overflow-hidden bg-line ${className ?? ""}`}
    >
      {inner}
    </button>
  );
}

/**
 * サムネイル1点。動画なら中央に再生アイコンを重ねて写真と区別する（4.5.1）。
 * MediaGrid の各枠のほか、スポット写真一覧（SC-13、F-MP-05）のグリッドでも再利用する。
 */
export function MediaThumbnail({
  item,
  className,
}: {
  item: Pick<MediaItem, "mediaType" | "thumbnailUrl" | "alt">;
  className?: string;
}) {
  return (
    <span className={`relative block h-full w-full ${className ?? ""}`}>
      {/* loading-feedback Task 7: 届いた瞬間に薄く重ねて出す（要件 4.5.11 の場面 5） */}
      <FadeInImage src={item.thumbnailUrl} alt={item.alt} className="h-full w-full object-cover" />

      {item.mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center" data-video-overlay>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.45)" />
            <path d="M16 13l12 7-12 7z" fill="#fff" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function MediaGrid({
  items,
  postHref,
  linkToPost = false,
  morphPostId,
}: {
  items: MediaItem[];
  postHref?: string;
  /** v3.1（mentoring-7 Task5）: true なら写真のタップで postHref へ直接移る（モーダルは開かない）。投稿カードで使う。投稿詳細は false（モーダル） */
  linkToPost?: boolean;
  /**
   * loading-feedback Task 8-2（2026-10-02）: 代表写真（1 枚目）を投稿詳細の写真と繋げる。
   *
   * 【初心者向け】投稿の id を渡すと、一覧の写真と詳細の写真に**同じ名前**が付く。
   * ブラウザはその 1 枚が動いて育ったように見せるので、押した写真がそのまま大きくなる。
   *
   * **渡す場所を選べるようにしてある**のがこの引数の肝。
   * 1 つの画面に同じ名前が 2 つあると、どちらを繋ぐか決まらない。
   * 渡すのは投稿カード（PostCard）と投稿詳細（PostDetailScreen）だけで、
   * アルバムの格子など**同じ投稿が重なりうる場所には渡さない**。
   */
  morphPostId?: string;
}) {
  // 開いているモーダルの起点。null なら閉じている
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const cellHref = linkToPost && postHref ? postHref : undefined;

  if (items.length === 0) {
    return null;
  }

  const modal =
    openIndex !== null && !cellHref ? (
      <MediaModal items={items} startIndex={openIndex} onClose={() => setOpenIndex(null)} postHref={postHref} />
    ) : null;
  const cell = (index: number, className?: string, overflowCount?: number) => {
    const node = (
      <MediaCell key={items[index].id} item={items[index]} className={className} overflowCount={overflowCount} onOpen={() => setOpenIndex(index)} href={cellHref} />
    );
    // Task 8-2: 繋げるのは代表写真（1 枚目）だけ。2 枚目以降は詳細側に対応するものが無い
    if (index === 0 && morphPostId) {
      return (
        <PhotoMorph key={items[0].id} postId={morphPostId}>
          {node}
        </PhotoMorph>
      );
    }
    return node;
  };

  if (items.length === 1) {
    return (
      <>
        <div className="aspect-square w-full">{cell(0)}</div>
        {modal}
      </>
    );
  }

  if (items.length === 2) {
    return (
      <>
        <div className="grid aspect-[2/1] w-full grid-cols-2 gap-0.5">
          {cell(0)}
          {cell(1)}
        </div>
        {modal}
      </>
    );
  }

  if (items.length === 3) {
    return (
      <>
        <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5">
          {cell(0, "row-span-2")}
          {cell(1)}
          {cell(2)}
        </div>
        {modal}
      </>
    );
  }

  // 5点以上の場合、4枠目に「+N」を重ねる。N = 表示済み（1〜3枚目）を除いた残数
  const overflowCount = items.length > 4 ? items.length - 3 : undefined;

  return (
    <>
      <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5">
        {[0, 1, 2, 3].map((index) => cell(index, undefined, index === 3 ? overflowCount : undefined))}
      </div>
      {modal}
    </>
  );
}
