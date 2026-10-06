import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPlaceOfficialInfo, hasOfficialInfo } from "@/lib/google/place-details";
import { GoogleMapsAttribution } from "@/components/google/GoogleMapsAttribution";

/**
 * #701: スポット別の画面（SC-04）に出す Google の公式情報
 * 出典: 要件定義書 3.4.2「公式情報」・6.2「Google から借りるものの方針」
 *       ワイヤーフレーム決定事項 77・78
 *
 * 【初心者向け】出すのは**営業時間と公式サイトだけ**。どちらも「Google にしか無く、
 * 投稿では代わりにならないもの」。★・価格帯・写真・クチコミは借りない
 * （タビコエが自前で持っていて、並べるとどちらを見ればよいか分からなくなる）。
 *
 * **保存しません。** 画面を開くたびに `place_id` で 1 回引く。
 * この部品は Server Component なので、API の鍵はブラウザに渡らない（要件 6.2）。
 *
 * 出せないときは**黙って何も出さない**（エラーを出さない）。次の 3 つが該当する。
 *   1. `place_id` が無いスポット（利用者が自分で登録した場所、#700 より前に作られた場所）
 *   2. Google が落ちている・鍵が無い
 *   3. Google に営業時間も公式サイトも登録されていない
 */
export async function OfficialInfo({ spotId }: { spotId: string }) {
  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("place_id").eq("id", spotId).maybeSingle();
  const placeId = spot?.place_id;
  if (!placeId) return null;

  let info;
  try {
    info = await fetchPlaceOfficialInfo(placeId);
  } catch {
    return null;
  }
  if (!hasOfficialInfo(info)) return null;

  return (
    /* 枠と淡い下地でタビコエの情報と見分けられるようにする（規約の求め） */
    <section
      data-official-info
      aria-label="Google マップの情報"
      className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-tint px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <GoogleMapsAttribution />
        <span className="text-[10.5px] text-muted">の情報</span>
      </div>
      {info.openNow !== null && (
        <p className="text-[12.5px]">
          <span className="text-muted">いま</span>{" "}
          <span className={`font-bold ${info.openNow ? "text-done" : "text-muted"}`}>
            {info.openNow ? "営業中" : "営業時間外"}
          </span>
        </p>
      )}
      {info.weekdayDescriptions.length > 0 && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-muted">営業時間</summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-ink">
            {info.weekdayDescriptions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {info.websiteUri && (
        <a
          href={info.websiteUri}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target text-[12.5px] font-semibold text-accent underline underline-offset-2"
        >
          公式サイトを開く
        </a>
      )}
    </section>
  );
}

/**
 * #739: スポット別の一覧に差し込む要素を作る。
 *
 * 【初心者向け】スポット別の一覧には**入口が 2 つ**ある（`/spots/[id]` と `/search?spot=`）。
 * #701 では前者にしか差し込んでいなかったので、普段の導線（検索結果のカード）では何も出ていなかった。
 * 同じものを 2 か所に書かないよう、ここにまとめて両方から呼ぶ。
 *
 * **一覧より遅くてよい**ので Suspense に入れる。出せないときは黙って何も出さないので、骨組みも出さない。
 */
export function officialInfoSlot(spotId: string) {
  return (
    <Suspense fallback={null}>
      <OfficialInfo spotId={spotId} />
    </Suspense>
  );
}
