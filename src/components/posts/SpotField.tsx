"use client";

import { useEffect, useState } from "react";
import { SpotAutocompleteInput, type SpotCandidate } from "@/components/spots/SpotAutocompleteInput";
import { GoogleMapsAttribution } from "@/components/google/GoogleMapsAttribution";
import { PREFECTURES } from "@/lib/geo/prefectures";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { NearbySpot } from "@/lib/spots/nearby";
import type { RegisteredSpot } from "@/lib/spots/types";

/** 「新しい場所」の表示名（要件定義書 v3.0 3.3.5） */
export const NEW_PLACE_LABEL = "この場所（新しい場所）";

/** 近くのスポットを照合している間の表示（loading-feedback Task 4-5） */
export const RESOLVING_LABEL = "近くのスポットを探しています…";

/** #700: 確定したときに呼ぶ登録の既定実装（テストでは差し替える） */
export interface ConfirmSpotInput {
  name: string;
  lat: number;
  lng: number;
  placeId: string | null;
  prefecture: string | null;
}

async function defaultRegisterSpot(input: ConfirmSpotInput): Promise<RegisteredSpot> {
  const response = await fetchWithAuthRedirect("/api/spots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      source: "places",
      placeId: input.placeId,
      prefecture: input.prefecture,
    }),
  });
  // 半径 50m 以内に既存スポットがあれば、サーバーは 409 でそちらを返す。その場合は既存に寄せる
  if (response.status === 409) {
    const data = (await response.json()) as { existingSpot: NearbySpot };
    return {
      id: data.existingSpot.id,
      name: data.existingSpot.name,
      lat: data.existingSpot.lat,
      lng: data.existingSpot.lng,
      prefecture: data.existingSpot.prefecture,
      source: data.existingSpot.source,
    };
  }
  if (!response.ok) throw new Error("register_failed");
  const data = (await response.json()) as { spot: RegisteredSpot };
  return data.spot;
}

async function defaultFetchPrefecture(lat: number, lng: number): Promise<string | null> {
  const response = await fetchWithAuthRedirect(`/api/spots/prefecture?lat=${lat}&lng=${lng}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { prefecture: string | null };
  return data.prefecture;
}


/**
 * spot-selection-v3 Task4: スポット名欄（自動解決・「変更」からの候補検索・「この付近の新しい場所」）
 * 出典: docs/tasks/posts/spot-selection-v3/04-change-spot-by-name.md
 *       要件定義書 v3.0 3.3.5「スポット名欄」
 *
 * 【初心者向け】スポットの決まり方は 3 段階ある。
 *   1. lockedSpot（固定）: 入口で指定された／「変更」の検索で選んだスポット。地図を動かしても位置は変わらない
 *   2. resolvedSpot（自動）: 地図の中心から 50m 以内に見つかった登録済みスポット。名前を出すだけで、地図は動かせる
 *   3. どちらも無い: 「この場所（新しい場所）」。任意で名前を付けられる
 * 「変更」で名前検索に切り替え、候補を選ぶと 1 になる。「この付近の新しい場所」で固定を外して 3 に戻す
 * （地図はその候補の位置のまま。現地にいなくても登録の無い場所を決められる）。
 */
export function SpotField({
  lockedSpot,
  resolvedSpot,
  newPlaceName,
  onLock,
  onUnlock,
  onNewPlaceNameChange,
  searchSpots,
  isResolving = false,
  position = null,
  onMoveMapTo,
  registerSpot = defaultRegisterSpot,
  fetchPrefecture = defaultFetchPrefecture,
}: {
  lockedSpot: RegisteredSpot | null;
  resolvedSpot: NearbySpot | null;
  newPlaceName: string;
  /** 候補を選んだ（位置を固定する） */
  onLock: (spot: RegisteredSpot) => void;
  /** 固定を外して中央固定ピンに戻す。`keepPosition` は選んでいたスポットの位置に地図を置いたままにする */
  onUnlock: (keepPosition: LatLngLike | null) => void;
  onNewPlaceNameChange: (name: string) => void;
  searchSpots?: React.ComponentProps<typeof SpotAutocompleteInput>["searchSpots"];
  /**
   * loading-feedback Task 4-5（2026-10-02）: 近くのスポットを照合している最中か。
   *
   * 【初心者向け】地図を動かすと 300ms 後に「50m 以内の登録済みスポット」を調べ、
   * **スポット名が無言で入れ替わっていた**。待っている間は前の名前のままなので、
   * 動かしたのに何も起きていないように見え、名前が変わった瞬間に驚かされる。
   * 親（PostComposeScreen）が照合中かどうかを知っているので、そこから受け取る。
   */
  isResolving?: boolean;
  /**
   * #700: いまの地図の中心。**「この位置で確定」で保存する座標**。
   * 利用者が地図を動かすと親が更新するので、押した時点の値が入る。
   */
  position?: LatLngLike | null;
  /** #700: 候補を選んだとき、地図をその位置へ動かす */
  onMoveMapTo?: (position: LatLngLike) => void;
  /** #700: 確定したときの登録（テストで差し替える） */
  registerSpot?: (input: ConfirmSpotInput) => Promise<RegisteredSpot>;
  /** #700: 都道府県をあらかじめ埋めるための引き（テストで差し替える） */
  fetchPrefecture?: (lat: number, lng: number) => Promise<string | null>;
}) {
  // 「変更」を押して名前検索に切り替えている状態（上の isResolving とは別物）
  const [isSearching, setIsSearching] = useState(false);
  /*
   * #700: 確定を待っている Google の候補。
   *
   * 【初心者向け】前は候補を選んだ瞬間に登録していたので、Google が返した名前と座標が
   * そのまま保存されていた（規約が禁じている形）。いまはここに一度置き、
   * 利用者が地図のピンと名前・都道府県を確認して「この位置で確定」を押してから登録する。
   */
  const [pending, setPending] = useState<SpotCandidate | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingPrefecture, setPendingPrefecture] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // 確定待ちになったら、都道府県をあらかじめ埋める（間違っていれば利用者が選び直せる）
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    void fetchPrefecture(pending.lat, pending.lng)
      .then((prefecture) => {
        if (!cancelled && prefecture) setPendingPrefecture(prefecture);
      })
      .catch(() => {
        // 引けなくても進める（利用者が自分で選ぶ）
      });
    return () => {
      cancelled = true;
    };
  }, [pending, fetchPrefecture]);

  const startConfirm = (candidate: SpotCandidate) => {
    setPending(candidate);
    setPendingName(candidate.name);
    setPendingPrefecture("");
    setConfirmError(null);
    setIsSearching(false);
    onMoveMapTo?.({ lat: candidate.lat, lng: candidate.lng });
  };

  const confirm = async () => {
    if (!pending || isConfirming) return;
    const name = pendingName.trim() || pending.name;
    const at = position ?? { lat: pending.lat, lng: pending.lng };
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const spot = await registerSpot({
        name,
        lat: at.lat,
        lng: at.lng,
        placeId: pending.placeId,
        prefecture: pendingPrefecture || null,
      });
      setPending(null);
      onLock(spot);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setConfirmError("登録できませんでした。時間をおいてお試しください");
    } finally {
      setIsConfirming(false);
    }
  };

  if (pending) {
    return (
      <div className="flex w-full flex-col gap-2" data-spot-confirm>
        <p className="text-[12px] font-bold text-ink">この場所でよいか確かめてください</p>
        <p className="text-[11px] leading-[1.7] text-muted">
          地図を動かすとピンの位置が変わります。<b className="text-ink">確定した位置と名前が、タビコエのスポットになります。</b>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="spot-confirm-name" className="w-[84px] shrink-0 text-[11px] text-muted">
            場所の名前
          </label>
          <input
            id="spot-confirm-name"
            value={pendingName}
            onChange={(event) => setPendingName(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="spot-confirm-prefecture" className="w-[84px] shrink-0 text-[11px] text-muted">
            都道府県
          </label>
          <select
            id="spot-confirm-prefecture"
            value={pendingPrefecture}
            onChange={(event) => setPendingPrefecture(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">選ばない</option>
            {PREFECTURES.map((prefecture) => (
              <option key={prefecture.name} value={prefecture.name}>
                {prefecture.name}
              </option>
            ))}
          </select>
        </div>
        {confirmError && <p role="alert" className="text-[11px] text-saved">{confirmError}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={isConfirming}
            className="h-10 flex-1 rounded-[10px] border border-line text-[13px] font-semibold text-ink disabled:opacity-45"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={isConfirming}
            className="h-10 flex-1 rounded-[10px] bg-accent text-[13px] font-bold text-white disabled:opacity-45"
          >
            {isConfirming ? "登録しています…" : "この位置で確定"}
          </button>
        </div>
        {/* #699: 候補の名前は Google から来ているので、この画面にも表記を出す */}
        <div className="self-start">
          <GoogleMapsAttribution />
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="flex w-full items-start gap-2">
        <span className="w-[84px] shrink-0 pt-3 text-[12px] font-medium text-muted">スポット名 *</span>
        <div className="min-w-0 flex-1">
          <SpotAutocompleteInput
            selectedSpot={null}
            onSelect={(spot) => {
              if (spot) onLock(spot);
              setIsSearching(false);
            }}
            /* #700: Google 由来で未登録の候補は、登録せずに確定の一手へ回す */
            onPickUnregistered={startConfirm}
            searchSpots={searchSpots}
            onCancel={() => setIsSearching(false)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              onUnlock(null);
              setIsSearching(false);
            }}
            className="mt-2 text-[12px] font-medium text-accent underline underline-offset-2"
          >
            新しい場所（ピンの位置）にする
          </button>
        </div>
      </div>
    );
  }

  // Task 4-5: 固定していないときだけ照合が走る。照合中は前の名前を出さず、待っていると伝える
  const name = lockedSpot?.name ?? (isResolving ? RESOLVING_LABEL : (resolvedSpot?.name ?? NEW_PLACE_LABEL));
  // 照合中は「場所の名前」の入力欄を出さない（直後にスポットが見つかると引っこむため）
  const isNewPlace = !lockedSpot && !resolvedSpot && !isResolving;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="spot-field-name" className="w-[84px] shrink-0 text-[12px] font-medium text-muted">
          スポット名 *
        </label>
        <div
          id="spot-field-name"
          className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] border bg-surface px-3 text-[14px] text-ink ${
            lockedSpot ? "border-accent" : "border-line"
          }`}
          data-spot-field={lockedSpot ? "locked" : resolvedSpot ? "resolved" : "new"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-accent">
            <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className="min-w-0 flex-1 truncate" role={isResolving ? "status" : undefined}>
            {name}
          </span>
          <button type="button" onClick={() => setIsSearching(true)} className="shrink-0 text-[12px] font-medium text-accent underline underline-offset-2">
            変更
          </button>
        </div>
      </div>
      {lockedSpot && (
        <button
          type="button"
          onClick={() => onUnlock({ lat: lockedSpot.lat, lng: lockedSpot.lng })}
          className="tap-target self-end text-[11px] font-medium text-muted underline underline-offset-2"
        >
          この付近の新しい場所
        </button>
      )}
      {isNewPlace && (
        <div className="flex items-center gap-2">
          <span className="w-[84px] shrink-0 text-[11px] text-muted">場所の名前</span>
          <input
            value={newPlaceName}
            onChange={(event) => onNewPlaceNameChange(event.target.value)}
            placeholder="任意（例: 〇〇展望台）"
            aria-label="新しい場所の名前（任意）"
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}
    </div>
  );
}

export interface LatLngLike {
  lat: number;
  lng: number;
}
