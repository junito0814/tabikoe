"use client";

import { useRouter } from "next/navigation";
import { useCurrentPosition } from "@/lib/geo/use-current-position";
import { composeHref } from "@/lib/posts/compose-initial-state";
import { PostHereButton } from "./PostHereButton";

/**
 * #807: 右下に浮いた「＋ ここに投稿」（ホーム・計画・マイページ）
 * 出典: 要件定義書 3.3.8・3.4.1・4.2、ワイヤーフレーム決定事項 83
 *
 * 【初心者向け】投稿はメニューバーの項目にせず、X の投稿ボタンと同じく**右下に浮かせる**。
 * バーは「場所の切替」、投稿は「どこでも押せる動作」なので、同じ列に並べない。
 * 出すのはホーム・計画・マイページの 3 画面だけ（通知・検索結果には出さない。決定事項 83）。
 *
 * 押すと位置情報を取り、現在地にピンが刺さった投稿画面（/posts/new?lat&lng&from=current）を開く。
 * 拒否されたら位置なしで開く（投稿画面が東京駅周辺を出し、地図を動かす案内を出す。3.3.5）。
 * これは以前ホームにあった「ここを投稿」とまったく同じ動き。
 *
 * 位置は右 16px・メニューバーの 16px 上（60 + 16 = 76px）。パソコン幅ではバーが左の縦並びになるので下 16px。
 *
 * #1015（2026-10-24）: ~~`[body:has([data-menu-bar])]` でバーの有無に追随する~~ のをやめた。
 *
 * 【初心者向け】#901 でメニューバーは **Cookie を読んでから届く**ようになりました（`<Suspense>` の中）。
 * 「バーがあれば 76px」という書き方だと、**最初の描画ではバーが無いので 16px に置かれ、
 * バーが届いた瞬間に 76px へ跳ねます**（本番で「右下から動いて出る」と見えていた現象）。
 * このボタンが出るのはホーム・計画・マイページ・地図の 4 画面だけで、**どれもバーが出る画面**なので、
 * 追随をやめて最初から 76px に置けば跳ねません。
 */
export function PostFab({ geolocation }: { /** 差し替え口（単体テスト用） */ geolocation?: Pick<Geolocation, "getCurrentPosition"> }) {
  const router = useRouter();
  const { locate, isLocating } = useCurrentPosition(geolocation);

  const postHere = async () => {
    const result = await locate();
    if (!result.ok) {
      router.push(composeHref({ kind: "current" }));
      return;
    }
    router.push(composeHref({ kind: "current", lat: result.lat, lng: result.lng }));
  };

  return (
    <div className="fixed bottom-[76px] right-4 z-30 md:bottom-4" data-post-fab>
      <PostHereButton onClick={() => void postHere()} disabled={isLocating} />
    </div>
  );
}
