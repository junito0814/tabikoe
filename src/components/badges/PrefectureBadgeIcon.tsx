import { motifFill, prefectureMotif, MOTIF_STROKE_WIDTH } from "@/lib/badges/prefecture-motifs";

/**
 * #977（prefecture-motifs Task 2）: 都道府県バッジの絵
 * 出典: docs/tasks/badges/prefecture-motifs/02-badge-icon-ui.md
 *       要件定義書 4.5.20（描き方の決まり）・4.5.14、8 章 101
 *
 * 【初心者向け】**金の二重の輪**の中に、その県の名産・シンボルの絵を描きます。
 * 二重にするだけでメダルに見え、金にすると **🏅 のまま残すほかのバッジと形がそろいます**
 * （投稿数・いいね数・スポット登録の 3 種類は 🏅 のままです。要件 4.5.14）。
 *
 * 絵を持っていない県では **何も返しません**（`null`）。呼ぶ側が 🏅 に落とします
 * （要件 8 章 102）。47 県の絵が揃う前でも画面が壊れないための作りです。
 */

/** 枠の色（金）。メダルに見せるため、どの県でも同じ */
export const BADGE_RING_COLOR = "#d4a52a";

/** 既定の大きさ。48px では細かい絵（しゃちほこ・ラクダ・シーサー）が潰れた（要件 4.5.20） */
export const PREFECTURE_BADGE_SIZE = 56;

/** 輪の中の塗りの薄さ。絵の塗り（22%）より淡くして、絵が沈まないようにする */
const RING_FILL_PERCENT = 12;

/** 絵の大きさ。内側の輪（半径 38）にぶつからない値 */
const MOTIF_SCALE = 0.7;

export function PrefectureBadgeIcon({
  prefecture,
  size = PREFECTURE_BADGE_SIZE,
}: {
  /** 県名。`catalog.ts` の `PREFECTURES` と同じ表記 */
  prefecture: string;
  size?: number;
}) {
  const motif = prefectureMotif(prefecture);
  if (!motif) return null;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="block">
      {/* 外側の輪。中は金の 12% だけ塗る（背景が透けるので、ライトでもダークでも成り立つ） */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill={`color-mix(in srgb, ${BADGE_RING_COLOR} ${RING_FILL_PERCENT}%, transparent)`}
        stroke={BADGE_RING_COLOR}
        strokeWidth="5"
      />
      {/* 内側の細い輪。これ 1 本でメダルに見える */}
      <circle cx="50" cy="50" r="38" fill="none" stroke={BADGE_RING_COLOR} strokeWidth="2.4" />
      <g transform={`translate(50 50) scale(${MOTIF_SCALE}) translate(-50 -50)`}>
        {motif.layers.map((layer, index) => (
          <path
            key={index}
            d={layer.d}
            fill={layer.fill ? motifFill(layer.fill) : "none"}
            stroke={layer.stroke}
            strokeWidth={layer.stroke ? (layer.w ?? MOTIF_STROKE_WIDTH) : undefined}
            strokeLinecap={layer.stroke ? "round" : undefined}
            strokeLinejoin={layer.stroke ? "round" : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
