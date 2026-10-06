"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { PostLocationMap } from "@/components/posts/PostLocationMap";
import type { LatLng } from "@/components/map/initial-center";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { PREFECTURES } from "@/lib/geo/prefectures";
import { MAX_SPOT_NAME_LENGTH } from "@/lib/moderation/spot-fix";
import { BackLink } from "@/components/layout/BackLink";

export type SubmitSpotFix = (spotId: string, body: { name: string; prefecture: string | null; lat: number; lng: number }) => Promise<Response>;

/**
 * strike-system Task 6: スポットの修正（SC-29）
 * 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
 *       docs/wireframes.md「SC-29 スポットの修正」
 *
 * 【初心者向け】修正依頼の通知から開く。自分が登録した「タビコエだけの場所」だけ直せる（それ以外はページが 404）。
 * 位置は投稿画面と同じ PostLocationMap（地図を動かすと中央のピンが動く）。保存で通報は対応済みになる。
 */
export function SpotFixScreen({
  spot,
  requestNote,
  submit = defaultSubmit,
  resolveCenter,
}: {
  spot: { id: string; name: string; prefecture: string | null; lat: number; lng: number };
  /** 管理者からの依頼の内容（無ければ出さない） */
  requestNote: string | null;
  submit?: SubmitSpotFix;
  resolveCenter?: React.ComponentProps<typeof PostLocationMap>["resolveCenter"];
}) {
  const router = useRouter();
  const [name, setName] = useState(spot.name);
  const [prefecture, setPrefecture] = useState(spot.prefecture ?? "");
  const [position, setPosition] = useState<LatLng>({ lat: spot.lat, lng: spot.lng });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameLength = [...name.trim()].length;
  const canSubmit = nameLength > 0 && nameLength <= MAX_SPOT_NAME_LENGTH && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submit(spot.id, { name: name.trim(), prefecture: prefecture || null, lat: position.lat, lng: position.lng });
      if (!response.ok) {
        setErrorMessage(response.status === 403 ? "このスポットは直せません" : "保存できませんでした");
        return;
      }
      router.push(`/spots/${spot.id}?fixed=1`);
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("保存できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = "mt-0.5 block h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink";

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex items-center gap-3">
          {/* #813: 記号だけの ‹ をやめ、戻り先の画面名を出す共通部品に揃えた */}
          <BackLink href="/notifications" label="通知" />
          <h1 className="text-[18px] font-bold text-ink">スポットの修正</h1>
        </header>

        {requestNote && (
          <p role="note" className="rounded-[12px] border border-accent/40 bg-tint p-3 text-[13px] leading-[1.7] text-ink">
            「{spot.name}」の情報に指摘があります：{requestNote}
          </p>
        )}

        <label className="text-[12px] font-medium text-muted">
          スポット名
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_SPOT_NAME_LENGTH * 2} className={field} />
          <span className="text-[11px]">
            {nameLength}/{MAX_SPOT_NAME_LENGTH}
          </span>
        </label>
        <label className="text-[12px] font-medium text-muted">
          都道府県
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className={field}>
            <option value="">未設定</option>
            {PREFECTURES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-[12px] font-medium text-muted">位置（地図を動かしてピンを合わせる）</p>
          <PostLocationMap initialCenter={{ lat: spot.lat, lng: spot.lng }} lockedPosition={null} onCenterChange={setPosition} resolveCenter={resolveCenter} className="mt-1 h-[260px] overflow-hidden rounded-[12px]" />
        </div>

        {errorMessage && <ErrorNotice message={errorMessage} />}

        <button type="submit" disabled={!canSubmit} className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
          {isSubmitting ? "保存中..." : "直した内容を保存する"}
        </button>
        <p className="text-[11px] text-muted">自分が登録した場所だけ直せます。保存すると、このスポットへの「情報の誤り」の通報は対応済みになります</p>
      </form>
    </div>
  );
}

function defaultSubmit(spotId: string, body: { name: string; prefecture: string | null; lat: number; lng: number }): Promise<Response> {
  return fetchWithAuthRedirect(`/api/spots/${spotId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
