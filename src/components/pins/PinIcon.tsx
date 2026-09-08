import { PIN_STYLES, type PinType } from "./pin-styles";

/**
 * ピンの表示ルール Task1: ピン種別ごとのアイコン・色定義
 * 出典: docs/tasks/shared-ui/pin-display-rules/01-pin-icon-definitions.md
 *
 * 形状（circle/diamond/square）に加え、種別ごとに異なる記号を中央に重ねることで、
 * グレースケール環境でも3種別が判別できるようにする。
 */
export function PinIcon({ type, size = 32 }: { type: PinType; size?: number }) {
  const style = PIN_STYLES[type];

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={style.label}>
      {style.shape === "circle" && <circle cx="16" cy="16" r="12" fill={style.color} />}
      {style.shape === "diamond" && (
        <rect x="7" y="7" width="18" height="18" rx="2" fill={style.color} transform="rotate(45 16 16)" />
      )}
      {style.shape === "square" && <rect x="5" y="5" width="22" height="22" rx="5" fill={style.color} />}

      {style.type === "normal" && <circle cx="16" cy="16" r="3.5" fill="#fff" />}
      {style.type === "wishlist" && (
        <path
          d="M16 21.5c-4.2-2.9-7.2-5.6-7.2-9A4 4 0 0 1 16 10a4 4 0 0 1 7.2 2.5c0 3.4-3 6.1-7.2 9z"
          fill="#fff"
        />
      )}
      {style.type === "posted" && (
        <path
          d="M10.5 16.3l3.7 3.7 7.3-7.7"
          stroke="#fff"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
