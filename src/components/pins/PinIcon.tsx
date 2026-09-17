import { DAY_PIN_COLORS, getPinStyle, type AnyPinType } from "./pin-styles";

/**
 * pin-display-rules-v3 Task1: ピン種別ごとのアイコン（画面内の SVG）
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/01-pin-types-and-icons.md
 *
 * 【初心者向け】凡例や一覧の中で使う React 版のピン。色は CSS 変数（var(--accent) など）をそのまま使えるので、
 * ダークモードでは自動で切り替わる。Google マップのマーカー用は pin-marker-icon.ts（同じ図形を文字列で組む）。
 */
export function PinIcon({
  type,
  size = 32,
  label,
  dayIndex,
  done,
}: {
  type: AnyPinType;
  size?: number;
  /** numbered / cluster の中に出す文字 */
  label?: string | number;
  dayIndex?: number | null;
  done?: boolean;
}) {
  const style = getPinStyle(type);
  const white = "var(--surface)";
  let fill = `var(--${style.color})`;
  if (style.type === "numbered") {
    fill = done ? "var(--muted)" : DAY_PIN_COLORS[((dayIndex ?? 1) - 1 + DAY_PIN_COLORS.length) % DAY_PIN_COLORS.length];
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={style.label}>
      {style.glyph === "halo" && <circle cx="16" cy="16" r="15" fill={fill} opacity="0.25" />}
      {style.shape === "diamond" ? (
        <rect x="7" y="7" width="18" height="18" rx="2" fill={fill} transform="rotate(45 16 16)" />
      ) : style.dashed ? (
        <circle cx="16" cy="16" r="11" fill={white} stroke={fill} strokeWidth="2" strokeDasharray="4 3" />
      ) : (
        <circle cx="16" cy="16" r={style.glyph === "halo" ? 10 : 12} fill={fill} />
      )}

      {(style.glyph === "dot" || style.glyph === "halo") && <circle cx="16" cy="16" r="3.5" fill={white} />}
      {style.glyph === "heart" && (
        <path d="M16 21.5c-4.2-2.9-7.2-5.6-7.2-9A4 4 0 0 1 16 10a4 4 0 0 1 7.2 2.5c0 3.4-3 6.1-7.2 9z" fill={white} />
      )}
      {style.glyph === "check" && (
        <path d="M10.5 16.3l3.7 3.7 7.3-7.7" stroke={white} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {style.glyph === "pencil" && <path d="M12 20l1-3 6-6 2 2-6 6z" fill={fill} />}
      {(style.glyph === "number" || style.glyph === "count") && (
        <text x="16" y="20.5" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="Arial, sans-serif" fill={white}>
          {label ?? ""}
        </text>
      )}
    </svg>
  );
}
