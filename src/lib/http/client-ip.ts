/**
 * Vercel等のリバースプロキシ経由で付与される`x-forwarded-for`からクライアントIPを取得する。
 * 複数ホップの場合は先頭（クライアントに最も近いもの）を使う。
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
