/**
 * 出典: #713（絵文字を減らす）
 * 要件定義書 4.5.14「記号と絵文字の使い方」・ワイヤーフレーム決定事項 81
 *
 * **文字では置き換えられないものだけ、線で描いた絵にする。**
 *
 * 【初心者向け】絵文字をやめる理由は、端末やブラウザによって形も大きさも変わり、
 * 行の高さが揺れるため。ほとんどは文字だけで足りるが、次の 4 つは文字にすると困る。
 *   - 💬 ♥ … **数字と並ぶ**ので、文字にすると「コメント 3 件」と長くなる
 *   - ⚠ … **注意の色**で意味を出している
 *   - ✎ … 「ここを押すと変えられる」という**合図**で、文字にすると説明文になってしまう
 *
 * 色は指定しない（置いた場所の色をそのまま継ぐ）。大きさは `size` で合わせる。
 */
function Icon({ size = 14, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

/** 名前を変えられる合図（もとの ✎） */
export function PencilIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 20h4L20 8l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  );
}

/** コメントの数（もとの 💬） */
export function CommentIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 5h16v10H9l-5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  );
}

/** いいねの数（もとの ♥）。色は置いた場所から継ぐ */
export function HeartIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  );
}

/** 注意（もとの ⚠） */
export function WarningIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}
