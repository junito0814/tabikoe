/**
 * 地図の下に出す「横スクロールのカード帯」の共通の計算
 * 出典: Bug #503（中央のカードの決め方）／Issue #763（しおりの全画面の地図にもカード帯を出す）
 *
 * 【初心者向け】ここは探すモード（`NearbyVoices`）としおりの全画面（`ItinerarySpotCards`）の
 * **両方**が使います。同じ計算を 2 か所に書くと、片方だけ直したときに動きがズレるためです（約束 14）。
 * カードは `data-map-card` という印を持つ要素、という約束だけ共有します。
 */

/** カード 1 枚に付ける印。この印を手がかりに中央のカードを探す */
export const CARD_ATTRIBUTE = "data-map-card";
const CARD_SELECTOR = `[${CARD_ATTRIBUTE}]`;

/** 指定した番号のカードを中央へ寄せる（map-restore Task1） */
export function scrollToCard(scroller: HTMLElement | null, index: number): void {
  const card = scroller?.querySelectorAll<HTMLElement>(CARD_SELECTOR)[index];
  // jsdom には scrollIntoView が無いので、あるときだけ呼ぶ
  card?.scrollIntoView?.({ block: "nearest", inline: "center" });
}

/**
 * 横スクロール領域の中央にいちばん近いカードの番号（Bug #503。単体テストの対象）。
 * 【初心者向け】`getBoundingClientRect()` は画面上の実際の位置を返す。カードの中心と、スクロール領域の中心の
 * 距離をくらべていちばん近いものを選ぶ。カードの幅・隙間・余白が変わっても、端まで送っても正しく決まる。
 */
export function centeredCardIndex(scroller: Pick<HTMLElement, "getBoundingClientRect"> & { querySelectorAll: HTMLElement["querySelectorAll"] }): number | null {
  const cards = Array.from(scroller.querySelectorAll<HTMLElement>(CARD_SELECTOR));
  if (cards.length === 0) return null;
  const box = scroller.getBoundingClientRect();
  const center = box.left + box.width / 2;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
