/**
 * admin-login Task 5: Supabase が返す QR コードを <img> に載せられる形に直す（純粋関数）
 * 出典: docs/tasks/admin/admin-login/05-mfa-screen.md
 *
 * 【初心者向け】`supabase.auth.mfa.enroll()` の `totp.qr_code` は SVG の文字列で返る。
 * SDK の型定義にも「`data:image/svg+xml;utf-8,` を前に付ければ URL になる」と書かれている。
 * 版によって既に data URI で返ることもあるため、両方を受け付けられるようにしておく。
 */

/**
 * QR コードを `<img src>` に渡せる文字列にする。渡せない形なら null（画面は手入力用の文字列だけ出す）。
 */
export function toQrImageSrc(qrCode: string | null | undefined): string | null {
  if (typeof qrCode !== "string") return null;
  const value = qrCode.trim();
  if (value.length === 0) return null;
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("<svg") || value.startsWith("<?xml")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
  }
  return null;
}

/** 手入力用の文字列を 4 文字ずつ区切って読みやすくする（画面に出すときだけ使う） */
export function formatTotpSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

/** 認証アプリに入れる 6 桁。空白・全角を許して数字 6 桁に正規化する。形が違えば null */
export function normalizeTotpCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input
    // 全角の数字を半角に直す（スマホのキーボードで混ざることがある）
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}
