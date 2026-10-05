/**
 * 出典: #699（Google の候補一覧に「Google マップ」の表記が無い）
 * 要件定義書 6.2・ワイヤーフレーム決定事項 77
 *
 * **Google 配布の公式ロゴ**を出す。規約で求められている表記。
 *
 * 【初心者向け】なぜ画像が 2 つあるか ── ロゴは**作り直してはいけない**（色も形も変えられない）。
 * そのため Google は「明るい背景用（濃い灰色）」と「暗い背景用（白）」の 2 枚を配っている。
 * `<picture>` の `media` で、OS の配色設定に合わせてブラウザが選ぶ。
 * タビコエのダークモードは `prefers-color-scheme` だけで切り替わるので（4.5.5）、同じ条件で揃う。
 *
 * 大きさの決まり: 高さ 16〜19px、まわりの余白は左右と上に 10px・下に 5px。
 * 素材は `public/google-maps/`（`Google_Maps_Attribution_Assets.zip` から取り出したもの。2026-10-05 取得）。
 */
export function GoogleMapsAttribution({ className }: { className?: string }) {
  return (
    <picture className={className}>
      <source media="(prefers-color-scheme: dark)" srcSet="/google-maps/google-maps-white.svg" />
      <img
        src="/google-maps/google-maps-dark-gray.svg"
        alt="Google マップ"
        width={98}
        height={18}
        data-google-maps-attribution
        className="h-[18px] w-auto"
      />
    </picture>
  );
}
