"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { useObjectUrls, type SelectedMedia } from "@/components/media/SelectedMediaThumbnails";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { LatLng } from "@/components/map/initial-center";
import type { ComposeInitialState } from "@/lib/posts/compose-initial-state";
import { MAX_DRAFTS_PER_USER, type PostCategory, type PostDuration, type PostVisibility } from "@/lib/posts/constants";
import type { NearbySpot } from "@/lib/spots/nearby";
import type { RegisteredSpot } from "@/lib/spots/types";
import { isVideoFile } from "@/lib/video/media-kind";
import { EMPTY_POST_FORM_VALUES, hasAnyPostInput, isPostFormComplete, PostFormFields, type PostFormValues } from "./PostFormFields";
import { PostLocationMap } from "./PostLocationMap";
import { useSheetDrag } from "@/components/layout/use-sheet-drag";
import { SpotField } from "./SpotField";
import { useDraftAutosave } from "./use-draft-autosave";
import { buildComposePayload, type UploadedMedia } from "./compose-payload";
import { POSTING_RESTRICTED_ERROR, postingRestrictedMessage } from "@/lib/moderation/posting-restriction";

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

/** 保存済み投稿（編集・下書きの続き）の初期値 */
export interface ExistingPostValues {
  postId: string;
  status: "draft" | "published";
  values: PostFormValues;
  spot: RegisteredSpot | null;
  position: LatLng | null;
  photos: { id: string; url: string; mediaType: "photo" | "video" }[];
}

export interface ComposeApi {
  upload: (files: File[]) => Promise<Response>;
  create: (payload: unknown) => Promise<Response>;
  update: (postId: string, payload: unknown) => Promise<Response>;
  attachMedia: (postId: string, media: UploadedMedia[]) => Promise<Response>;
  deletePhoto: (postId: string, photoId: string) => Promise<Response>;
  resolveSpot: (position: LatLng) => Promise<NearbySpot | null>;
}

/**
 * post-creation-v3 Task3 / spot-selection-v3 Task4 / draft Task2: 投稿画面（SC-03）
 * 出典: docs/tasks/posts/post-creation-v3/03-split-screen-layout.md
 *       docs/tasks/posts/spot-selection-v3/04-change-spot-by-name.md
 *       docs/tasks/posts/draft/02-draft-ui-autosave.md
 *       要件定義書 v3.0 3.3.1・3.3.5・3.3.7・3.3.8
 *
 * 【初心者向け】この画面は「上 1/3 が地図、下 2/3 がフォーム」。state はこのコンポーネントが全部持ち、
 * 地図（PostLocationMap）・スポット欄（SpotField）・項目（PostFormFields）は表示と入力だけを担当する。
 *   - position: 地図の中心＝投稿の位置。動くたびに 300ms 待って /api/spots/resolve で近くのスポットを調べる
 *   - lockedSpot: 入口や「変更」の検索で決めたスポット。あるときは地図を動かしても位置は変わらない
 *   - 「投稿する」: 写真をアップロード → POST（新規）または PATCH（下書き・編集）→ 投稿詳細へ
 *   - 「下書きに保存」: 必須項目が空でも保存できる。入力があれば 3 秒止まったときにも自動保存する（useDraftAutosave）
 *   - 自宅の保護: 現在地から開いて地図を動かさず「新しい場所」のまま投稿しようとしたら確認ダイアログ
 *   - フォームを上に引くと全画面（地図は隠れる）、下に引くと 1：2 に戻る。パソコン幅では左右 1：2
 */
export function PostComposeScreen({
  initial,
  existing = null,
  api = defaultApi,
  resolveCenter,
  fetchTripSuggestions,
  searchSpots,
  postingRestrictedUntil = null,
}: {
  initial: ComposeInitialState;
  existing?: ExistingPostValues | null;
  /** strike-system Task 2: 投稿禁止中なら解除日時（ISO）。理由を出して「投稿する」を無効にする */
  postingRestrictedUntil?: string | null;
  /** 差し替え口（単体テスト用） */
  api?: ComposeApi;
  resolveCenter?: React.ComponentProps<typeof PostLocationMap>["resolveCenter"];
  fetchTripSuggestions?: React.ComponentProps<typeof PostFormFields>["fetchTripSuggestions"];
  searchSpots?: React.ComponentProps<typeof SpotField>["searchSpots"];
}) {
  const router = useRouter();
  const isEditingPublished = existing?.status === "published";
  const isEditMode = existing !== null;

  // ---- フォームの値 ----
  const [values, setValues] = useState<PostFormValues>(() =>
    existing ? existing.values : { ...EMPTY_POST_FORM_VALUES, tripTitle: initial.tripTitle, visitDate: initial.visitDate }
  );
  const updateValues = useCallback((patch: Partial<PostFormValues>) => setValues((current) => ({ ...current, ...patch })), []);

  // ---- 位置とスポット ----
  const [position, setPosition] = useState<LatLng | null>(existing?.position ?? initial.center);
  const [lockedSpot, setLockedSpot] = useState<RegisteredSpot | null>(existing?.spot ?? initial.spot);
  const [resolvedSpot, setResolvedSpot] = useState<NearbySpot | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [moved, setMoved] = useState(false);
  const [centerFromCurrent, setCenterFromCurrent] = useState(initial.centerFromCurrentLocation);
  const mapInitialCenter = useMemo<LatLng | null>(() => existing?.position ?? initial.center, [existing?.position, initial.center]);

  // 地図が止まるたびに近くの登録済みスポットを調べる（固定中は調べない）
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCenterChange = useCallback(
    (center: LatLng) => {
      setPosition(center);
      if (lockedSpot) return;
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
      resolveTimer.current = setTimeout(() => {
        api.resolveSpot(center).then(setResolvedSpot).catch(() => setResolvedSpot(null));
      }, 300);
    },
    [api, lockedSpot]
  );
  useEffect(() => () => {
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
  }, []);

  // ---- 写真・動画 ----
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState(existing?.photos ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useObjectUrls(files);
  const mediaItems: SelectedMedia[] = [
    ...existingPhotos.map((photo) => ({ key: `existing:${photo.id}`, url: photo.url, mediaType: photo.mediaType, alt: "投稿済みの写真" })),
    ...objectUrls.map((entry, index) => ({
      key: `new:${index}`,
      url: entry.url,
      mediaType: isVideoFile(entry.file) ? ("video" as const) : ("photo" as const),
      alt: entry.file.name,
    })),
  ];
  const mediaCount = mediaItems.length;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingHome, setConfirmingHome] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetDrag = useSheetDrag(
    (snap) => setSheetExpanded(snap === "expand"),
    () => setSheetExpanded((current) => !current)
  );

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    setErrorMessage(null);
    for (const file of selected) {
      if (isVideoFile(file)) {
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          setErrorMessage("動画は1点あたり100MB以内にしてください");
          return;
        }
      } else if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setErrorMessage("写真はJPEGまたはPNG、動画はMP4またはMOVのみアップロードできます");
        return;
      } else if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setErrorMessage("写真は1点あたり10MB以内にしてください");
        return;
      }
    }
    setFiles((current) => [...current, ...selected]);
  };

  const handleRemoveMedia = async (key: string) => {
    if (key.startsWith("new:")) {
      const index = Number(key.slice(4));
      setFiles((current) => current.filter((_, i) => i !== index));
      return;
    }
    const photoId = key.slice("existing:".length);
    if (!existing) return;
    try {
      const response = await api.deletePhoto(existing.postId, photoId);
      if (response.status === 400) {
        setErrorMessage("写真は1点以上必要です。追加してから削除してください");
        return;
      }
      if (!response.ok) {
        setErrorMessage("写真を削除できませんでした");
        return;
      }
      setExistingPhotos((current) => current.filter((photo) => photo.id !== photoId));
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("写真を削除できませんでした");
    }
  };

  // ---- 保存 ----
  /** 下書き ID（新規作成後に入る。以降の保存は PATCH） */
  const [postId, setPostId] = useState<string | null>(existing?.postId ?? null);

  /** 新しく選んだファイルをアップロードし、既存投稿があれば紐づける。戻り値は新規作成に渡す media */
  const uploadPendingFiles = async (targetPostId: string | null): Promise<UploadedMedia[] | null> => {
    if (files.length === 0) return [];
    const response = await api.upload(files);
    if (!response.ok) {
      setErrorMessage(response.status === 503 ? "動画のアップロードは現在利用できません" : "写真・動画のアップロードに失敗しました");
      return null;
    }
    const uploaded = (await response.json()) as { media: UploadedMedia[] };
    if (targetPostId) {
      const attach = await api.attachMedia(targetPostId, uploaded.media);
      if (!attach.ok) {
        setErrorMessage("写真・動画の追加に失敗しました");
        return null;
      }
      setExistingPhotos((current) => [
        ...current,
        ...uploaded.media.map((m, i) => ({ id: `pending-${Date.now()}-${i}`, url: objectUrls[i]?.url ?? "", mediaType: m.mediaType })),
      ]);
      setFiles([]);
      return [];
    }
    return uploaded.media;
  };

  const save = async (status: "draft" | "published") => {
    if (!position) {
      setErrorMessage("位置を決めてください");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const media = await uploadPendingFiles(postId);
      if (media === null) return;

      const payload = buildComposePayload({
        status,
        values,
        position,
        spotId: lockedSpot?.id ?? resolvedSpot?.id ?? null,
        spotName: newPlaceName,
        media,
      });
      const response = postId ? await api.update(postId, payload) : await api.create(payload);

      if (response.status === 429) {
        setErrorMessage(status === "draft" ? "下書きの保存が集中しています。しばらく時間をおいてからお試しください" : "投稿の作成が集中しています。しばらく時間をおいてからお試しください");
        return;
      }
      if (response.status === 409) {
        setErrorMessage(`下書きは${MAX_DRAFTS_PER_USER}件までです。マイページで下書きを整理してください`);
        return;
      }
      if (response.status === 403) {
        // strike-system Task 2: 投稿禁止中
        const data = (await response.json().catch(() => ({}))) as { error?: string; until?: string };
        setErrorMessage(data.error === POSTING_RESTRICTED_ERROR && data.until ? postingRestrictedMessage(data.until) : "投稿できませんでした");
        return;
      }
      if (!response.ok) {
        setErrorMessage(status === "draft" ? "下書きを保存できませんでした" : "投稿できませんでした。入力内容をご確認ください");
        return;
      }
      const result = (await response.json()) as { postId: string; newBadges?: { type: string }[] };
      const badgeTypes = (result.newBadges ?? []).map((badge) => badge.type);

      if (status === "draft") {
        setPostId(result.postId);
        setFiles([]);
        router.push("/mypage?draftSaved=1");
      } else {
        const params = new URLSearchParams({ [isEditingPublished ? "updated" : "posted"]: "1" });
        if (badgeTypes.length > 0) params.set("badges", badgeTypes.join(","));
        router.push(`/posts/${result.postId}?${params.toString()}`);
      }
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(status === "draft" ? "下書きを保存できませんでした" : "投稿できませんでした。入力内容をご確認ください");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = () => {
    // spot-selection-v3 Task4: 自宅の保護。現在地由来・未移動・新しい場所のときだけ確認する
    const isNewPlace = !lockedSpot && !resolvedSpot;
    if (centerFromCurrent && !moved && isNewPlace && !isEditMode) {
      setConfirmingHome(true);
      return;
    }
    void save("published");
  };

  // draft Task2: 入力が 3 秒止まったら自動で下書きを保存（公開済みの編集では行わない）
  useDraftAutosave({
    enabled: !isEditingPublished && !isSubmitting,
    hasInput: hasAnyPostInput(values, mediaCount) || moved,
    snapshot: JSON.stringify({ values, position, spotId: lockedSpot?.id ?? resolvedSpot?.id ?? null, newPlaceName }),
    save: async () => {
      if (!position) return;
      const payload = buildComposePayload({
        status: "draft",
        values,
        position,
        spotId: lockedSpot?.id ?? resolvedSpot?.id ?? null,
        spotName: newPlaceName,
        media: [],
      });
      const response = postId ? await api.update(postId, payload) : await api.create(payload);
      if (response.ok && !postId) {
        const result = (await response.json()) as { postId: string };
        setPostId(result.postId);
      }
    },
  });

  const isPostingRestricted = !!postingRestrictedUntil;
  const canPublish = isPostFormComplete(values, mediaCount) && position !== null && !isSubmitting && !isPostingRestricted;

  return (
    <div className="flex h-[calc(100dvh-60px)] flex-col bg-app md:h-dvh md:flex-row" data-post-compose>
      {/* 上 1/3（パソコンでは左 1/3）: 地図 */}
      <div className={`relative shrink-0 transition-[height] md:h-full md:w-1/3 ${sheetExpanded ? "h-0 md:h-full" : "h-[34%]"}`}>
        <div className="absolute left-3 top-3 z-10">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="戻る"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface shadow-card"
          >
            ‹
          </button>
        </div>
        <PostLocationMap
          initialCenter={mapInitialCenter}
          lockedPosition={lockedSpot ? { lat: lockedSpot.lat, lng: lockedSpot.lng } : null}
          onCenterChange={handleCenterChange}
          onMovedChange={setMoved}
          onCurrentLocationResolved={({ center, fromCurrentLocation }) => {
            setPosition(center);
            setCenterFromCurrent(fromCurrentLocation);
          }}
          resolveCenter={resolveCenter}
          className="h-full w-full"
        />
      </div>

      {/* 下 2/3（パソコンでは右 2/3）: フォーム */}
      <div className="flex min-h-0 flex-1 flex-col rounded-t-[16px] border-t border-line bg-app shadow-card md:rounded-none md:border-l md:border-t-0">
        {/* v3.1（mentoring-7 Task11）: 取っ手を上にスライドで全画面、下にスライドで 1：2（use-sheet-drag.ts）。タップでも切り替わる */}
        <button
          type="button"
          {...sheetDrag}
          onClick={() => setSheetExpanded((current) => !current)}
          aria-label={sheetExpanded ? "地図を表示" : "フォームを広げる"}
          aria-expanded={sheetExpanded}
          data-sheet-handle
          className="flex h-6 w-full touch-none items-center justify-center md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 md:px-6 md:pt-4">
          <div className="mx-auto w-full max-w-[520px]">
            <h1 className="mb-3 text-[15px] font-bold text-ink">{isEditingPublished ? "投稿を編集" : postId ? "下書きの続き" : "投稿する"}</h1>
            <PostFormFields
              values={values}
              onChange={updateValues}
              spotField={
                <SpotField
                  lockedSpot={lockedSpot}
                  resolvedSpot={resolvedSpot}
                  newPlaceName={newPlaceName}
                  onLock={(spot) => {
                    setLockedSpot(spot);
                    setResolvedSpot(null);
                    setPosition({ lat: spot.lat, lng: spot.lng });
                  }}
                  onUnlock={(keepPosition) => {
                    setLockedSpot(null);
                    setResolvedSpot(null);
                    if (keepPosition) setPosition(keepPosition);
                    setMoved(true);
                  }}
                  onNewPlaceNameChange={setNewPlaceName}
                  searchSpots={searchSpots}
                />
              }
              mediaItems={mediaItems}
              onRemoveMedia={(key) => void handleRemoveMedia(key)}
              onAddMedia={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFilesSelected={handleFilesSelected}
              fetchTripSuggestions={fetchTripSuggestions}
            />
            {isPostingRestricted && postingRestrictedUntil && (
              <p role="note" className="mt-3 rounded-[8px] bg-tint px-3 py-2 text-[12px] leading-[1.7] text-ink">
                {postingRestrictedMessage(postingRestrictedUntil)}（下書きの保存はできます）
              </p>
            )}
            {errorMessage && <ErrorNotice className="mt-3" message={errorMessage} />}
            {isEditingPublished && (
              <p className="mt-4 text-center text-[12px] text-muted">
                <Link href={`/posts/${existing?.postId}`} className="underline underline-offset-2">
                  編集をやめて投稿に戻る
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* 下に固定: 投稿する／下書きに保存 */}
        <div className="flex gap-2 border-t border-line bg-surface px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="h-12 flex-1 rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? "送信中..." : isEditingPublished ? "更新する" : "投稿する"}
          </button>
          {!isEditingPublished && (
            <button
              type="button"
              onClick={() => void save("draft")}
              disabled={isSubmitting || position === null}
              className="h-12 flex-1 rounded-[10px] border border-line bg-surface text-[14px] font-semibold text-ink disabled:opacity-45"
            >
              下書きに保存
            </button>
          )}
        </div>
      </div>

      {confirmingHome && (
        <div role="dialog" aria-modal="true" aria-labelledby="home-guard-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-[380px] rounded-[14px] bg-surface p-6 shadow-xl">
            <h2 id="home-guard-title" className="mb-3 text-[16px] font-bold text-ink">
              この位置を公開しますか？
            </h2>
            <p className="mb-4 text-[13px] leading-[1.7] text-ink">
              この位置に新しいスポットを登録して公開します。自宅など公開したくない場所ではありませんか？
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingHome(false)}
                className="h-11 flex-1 rounded-[10px] border border-line text-[14px] font-medium text-ink"
              >
                場所を変える
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingHome(false);
                  void save("published");
                }}
                className="h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-semibold text-white"
              >
                投稿する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 本番で使う API 呼び出し。テストではこのオブジェクトを差し替える */
const defaultApi: ComposeApi = {
  upload: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));
    return fetchWithAuthRedirect("/api/posts/photos", { method: "POST", body: formData });
  },
  create: (payload) =>
    fetchWithAuthRedirect("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  update: (postId, payload) =>
    fetchWithAuthRedirect(`/api/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  attachMedia: (postId, media) =>
    fetchWithAuthRedirect(`/api/posts/${postId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media }) }),
  deletePhoto: (postId, photoId) => fetchWithAuthRedirect(`/api/posts/${postId}/photos/${photoId}`, { method: "DELETE" }),
  resolveSpot: async (position) => {
    const response = await fetchWithAuthRedirect(`/api/spots/resolve?lat=${position.lat}&lng=${position.lng}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { spot: NearbySpot | null };
    return data.spot;
  },
};

// 型の再エクスポート（page.tsx が初期値を組むときに使う）
export type { PostCategory, PostDuration, PostVisibility };
