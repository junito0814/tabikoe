"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripTitleInput } from "@/components/trips/TripTitleInput";
import { SpotAutocompleteInput } from "@/components/spots/SpotAutocompleteInput";
import { UploadNotice } from "@/components/notices/UploadNotice";
import { DeletePostButton } from "./DeletePostButton";
import { buildPostedHref, buildUpdatedHref } from "@/components/badges/badge-toast-params";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  uploadVideo,
  validateVideoFile,
  VIDEO_ERROR_MESSAGES,
  VideoUploadError,
  type UploadedVideoMedia,
} from "@/lib/video/client-upload";
import type { RegisteredSpot } from "@/lib/spots/types";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPE,
  MAX_PHOTO_SIZE_BYTES,
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  MAX_POST_RATING,
  MIN_POST_COST,
  POST_CATEGORIES,
  POST_DURATIONS,
  todayInJst,
  type PostCategory,
  type PostDuration,
  type PostVisibility,
} from "@/lib/posts/constants";

const ALLOWED_PHOTO_TYPES: readonly string[] = ALLOWED_PHOTO_MIME_TYPES;
const isVideoFile = (file: File) => file.type === ALLOWED_VIDEO_MIME_TYPE;

/**
 * SC-03 投稿作成・編集画面
 * 出典: docs/tasks/posts/post-creation/02-post-form-ui.md（F-PO-01 Task2）
 *       docs/tasks/posts/post-edit/03-post-edit-ui.md（F-PO-02 Task3）
 *
 * 3.3.3が「編集可能項目＝投稿の全項目」としており、入力規則も作成時と同じため、
 * 同じフォームを編集モードとして再利用する（initialPostの有無で切り替える）。
 * 旅行タイトル・スポット名は trip-title / spot-selection の成果物を組み込む。
 * 動画（MP4）は写真と同じ選択欄から追加でき、本体は Storage へ直接送る（video-upload Task3）。
 */
export interface ExistingPhoto {
  id: string;
  /** 写真の縮小画像、または動画のサムネイル */
  url: string;
  mediaType?: "photo" | "video";
}

export interface PostFormInitialValues {
  postId: string;
  tripTitle: string;
  spot: RegisteredSpot;
  category: PostCategory;
  visitDate: string;
  duration: PostDuration;
  cost: string;
  rating: number;
  comment: string;
  visibility: PostVisibility;
  photos: ExistingPhoto[];
}

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="星評価">
      {Array.from({ length: MAX_POST_RATING }, (_, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star}`}
          onClick={() => onChange(star)}
          className="text-[26px] leading-none"
          style={{ color: star <= value ? "#C4703F" : "#E8E1D8" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <span className="mb-1.5 block text-[12px] font-medium text-[#9C9488]">{label}</span>
      {children}
    </div>
  );
}

const selectClass =
  "h-11 w-full rounded-[10px] border border-[#E8E1D8] bg-white px-3 text-[14px] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]";

export default function PostForm({ initialPost }: { initialPost?: PostFormInitialValues }) {
  const router = useRouter();
  const isEditMode = initialPost !== undefined;

  const [tripTitle, setTripTitle] = useState(initialPost?.tripTitle ?? "");
  const [spot, setSpot] = useState<RegisteredSpot | null>(initialPost?.spot ?? null);
  const [category, setCategory] = useState<PostCategory | "">(initialPost?.category ?? "");
  const [visitDate, setVisitDate] = useState(initialPost?.visitDate ?? "");
  const [duration, setDuration] = useState<PostDuration | "">(initialPost?.duration ?? "");
  const [cost, setCost] = useState(initialPost?.cost ?? "");
  const [rating, setRating] = useState(initialPost?.rating ?? 0);
  const [comment, setComment] = useState(initialPost?.comment ?? "");
  const [visibility, setVisibility] = useState<PostVisibility>(
    initialPost?.visibility ?? "public"
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    initialPost?.photos ?? []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const commentLength = graphemeLength(comment);
  const isCommentTooLong = commentLength > MAX_POST_COMMENT_LENGTH;

  const costNumber = cost === "" ? null : Number(cost);
  const isCostInvalid =
    costNumber !== null &&
    (!Number.isInteger(costNumber) || costNumber < MIN_POST_COST || costNumber > MAX_POST_COST);

  // 写真は1点以上必須（3.3.1）。編集時は既存分と新規追加分の合計で判定する
  const totalPhotoCount = existingPhotos.length + photos.length;

  const canSubmit =
    tripTitle.trim().length > 0 &&
    spot !== null &&
    category !== "" &&
    duration !== "" &&
    rating > 0 &&
    totalPhotoCount > 0 &&
    !isCommentTooLong &&
    !isCostInvalid &&
    !isSubmitting;

  const handleDeleteExistingPhoto = async (photoId: string) => {
    if (!initialPost) return;
    setErrorMessage(null);

    try {
      const response = await fetchWithAuthRedirect(
        `/api/posts/${initialPost.postId}/photos/${photoId}`,
        { method: "DELETE" }
      );

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

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setErrorMessage(null);

    const invalidType = selected.find(
      (file) => !ALLOWED_PHOTO_TYPES.includes(file.type) && !isVideoFile(file)
    );
    if (invalidType) {
      setErrorMessage("写真はJPEG／PNG、動画はMP4形式のみアップロードできます");
      return;
    }
    const tooLarge = selected.find(
      (file) => !isVideoFile(file) && file.size > MAX_PHOTO_SIZE_BYTES
    );
    if (tooLarge) {
      setErrorMessage("写真は1点あたり10MB以内にしてください");
      return;
    }
    const videoError = selected
      .filter(isVideoFile)
      .map(validateVideoFile)
      .find((code) => code !== null);
    if (videoError) {
      setErrorMessage(VIDEO_ERROR_MESSAGES[videoError]);
      return;
    }

    setPhotos(selected);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !spot) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    let newBadgeTypes: string[] = [];

    try {
      // 先に写真・動画を処理し、返ったパスを投稿へ渡す（要件定義書3.3.1の処理フロー）。
      // 選択順を保つため、写真はまとめて1回、動画は1本ずつ処理してから元の順に並べ直す
      const uploadedMedia: (UploadedVideoMedia | { mediaType: "photo"; storagePath: string })[] =
        [];
      const photoFiles = photos.filter((file) => !isVideoFile(file));
      const videoFiles = photos.filter(isVideoFile);

      let uploadedPhotoPaths: string[] = [];
      if (photoFiles.length > 0) {
        const formData = new FormData();
        photoFiles.forEach((photo) => formData.append("photos", photo));

        const uploadResponse = await fetchWithAuthRedirect("/api/posts/photos", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          setErrorMessage("写真のアップロードに失敗しました");
          return;
        }

        const uploaded = (await uploadResponse.json()) as {
          photos: { storagePath: string }[];
        };
        uploadedPhotoPaths = uploaded.photos.map((photo) => photo.storagePath);
      }

      const uploadedVideos: UploadedVideoMedia[] = [];
      for (const [index, file] of videoFiles.entries()) {
        setUploadProgress(`動画を処理中... (${index + 1}/${videoFiles.length})`);
        try {
          uploadedVideos.push(await uploadVideo(file));
        } catch (error) {
          if (error instanceof VideoUploadError) {
            setErrorMessage(VIDEO_ERROR_MESSAGES[error.code]);
            return;
          }
          throw error;
        }
      }
      setUploadProgress(null);

      let photoCursor = 0;
      let videoCursor = 0;
      for (const file of photos) {
        uploadedMedia.push(
          isVideoFile(file)
            ? uploadedVideos[videoCursor++]
            : { mediaType: "photo", storagePath: uploadedPhotoPaths[photoCursor++] }
        );
      }

      const fields = {
        tripTitle,
        spotId: spot.id,
        category,
        visitDate: visitDate || null,
        duration,
        cost: costNumber,
        rating,
        comment,
        visibility,
      };

      if (initialPost) {
        // 追加分の写真・動画を既存投稿へ紐づけてから、本体を更新する
        if (uploadedMedia.length > 0) {
          const attachResponse = await fetchWithAuthRedirect(
            `/api/posts/${initialPost.postId}/photos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ media: uploadedMedia }),
            }
          );
          if (!attachResponse.ok) {
            setErrorMessage("写真の追加に失敗しました");
            return;
          }
        }

        const response = await fetchWithAuthRedirect(`/api/posts/${initialPost.postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });

        if (!response.ok) {
          setErrorMessage("投稿の更新に失敗しました。入力内容をご確認ください");
          return;
        }

        // F-BG Task2（#251）: スポット変更でご当地バッジを獲得した場合も遷移先でトースト表示する
        const result = (await response.json().catch(() => ({}))) as {
          newBadges?: { type: string }[];
        };
        newBadgeTypes = (result.newBadges ?? []).map((badge) => badge.type);
      } else {
        const response = await fetchWithAuthRedirect("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, media: uploadedMedia }),
        });

        if (response.status === 429) {
          setErrorMessage("投稿の作成が集中しています。しばらく時間をおいてからお試しください");
          return;
        }
        if (!response.ok) {
          setErrorMessage("投稿の作成に失敗しました。入力内容をご確認ください");
          return;
        }

        // F-BG Task5: 新たに獲得したバッジは遷移先でトースト表示する（通知一覧には残さない）
        const result = (await response.json().catch(() => ({}))) as {
          newBadges?: { type: string }[];
        };
        newBadgeTypes = (result.newBadges ?? []).map((badge) => badge.type);
      }

      // 投稿後の遷移先は要件定義書に定義がない。本来の遷移先になりうる
      // 投稿詳細（SC-05）・マイページ（SC-06）が未実装のため、
      // 暫定でトップページへ戻し、完了したことだけを伝える。
      router.push(initialPost ? buildUpdatedHref(newBadgeTypes) : buildPostedHref(newBadgeTypes));
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(
        initialPost
          ? "投稿の更新に失敗しました。入力内容をご確認ください"
          : "投稿の作成に失敗しました。入力内容をご確認ください"
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 bg-[#FBF6F0] px-6 py-12">
      <h1 className="text-[16px] font-bold text-[#3D3A35]">
        {isEditMode ? "投稿を編集" : "新規投稿"}
      </h1>

      <div className="flex w-full max-w-[360px] flex-col gap-5">
        <TripTitleInput value={tripTitle} onChange={setTripTitle} />
        <SpotAutocompleteInput selectedSpot={spot} onSelect={setSpot} />

        <Field label="カテゴリ">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as PostCategory)}
            className={selectClass}
          >
            <option value="">選択してください</option>
            {POST_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="日付（任意）">
          <input
            type="date"
            value={visitDate}
            max={todayInJst()}
            onChange={(event) => setVisitDate(event.target.value)}
            className={selectClass}
          />
        </Field>

        <Field label="滞在時間">
          <select
            value={duration}
            onChange={(event) => setDuration(event.target.value as PostDuration)}
            className={selectClass}
          >
            <option value="">選択してください</option>
            {POST_DURATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="費用（任意・1人あたり／円）">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_POST_COST}
            max={MAX_POST_COST}
            step={1}
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className={selectClass}
          />
          {isCostInvalid && (
            <p className="mt-1 text-[11px] text-[#C4703F]">
              0〜{MAX_POST_COST.toLocaleString()}の整数で入力してください
            </p>
          )}
        </Field>

        <Field label="星評価">
          <StarRating value={rating} onChange={setRating} />
        </Field>

        <Field label="写真・動画">
          {existingPhotos.length > 0 && (
            <ul className="mb-2 grid grid-cols-3 gap-2">
              {existingPhotos.map((photo) => (
                <li key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.mediaType === "video" ? "投稿済みの動画" : "投稿済みの写真"}
                    className="aspect-square w-full rounded-[8px] object-cover"
                  />
                  {photo.mediaType === "video" && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      動画
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingPhoto(photo.id)}
                    aria-label="この写真を削除"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[13px] leading-none text-white"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,video/mp4"
            multiple
            onChange={handlePhotoChange}
            className="text-[12px]"
          />
          <p className="mt-1 text-[11px] text-[#9C9488]">
            写真はJPEG／PNG（10MBまで）、動画はMP4（100MB・1分以内）
          </p>
          {photos.length > 0 && (
            <p className="mt-1 text-[11px] text-[#9C9488]">
              {photos.length}点を選択中
              {photos.some(isVideoFile) && `（うち動画${photos.filter(isVideoFile).length}点）`}
            </p>
          )}
          <div className="mt-2">
            <UploadNotice />
          </div>
        </Field>

        <Field label="感想（任意）">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={5}
            className="w-full rounded-[10px] border border-[#E8E1D8] bg-white px-3 py-2.5 text-[14px] leading-[1.7] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]"
          />
          <p
            className={`mt-1 text-[11px] ${isCommentTooLong ? "text-[#C4703F]" : "text-[#9C9488]"}`}
          >
            {commentLength} / {MAX_POST_COMMENT_LENGTH}
          </p>
        </Field>

        <Field label="公開設定">
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as PostVisibility)}
            className={selectClass}
          >
            <option value="public">公開</option>
            <option value="private">非公開</option>
          </select>
        </Field>

        {uploadProgress && <p className="text-[12px] text-[#9C9488]">{uploadProgress}</p>}
        {errorMessage && <ErrorNotice message={errorMessage} />}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-[10px] bg-[#C4703F] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting
            ? isEditMode
              ? "更新中..."
              : "投稿中..."
            : isEditMode
              ? "更新する"
              : "投稿する"}
        </button>

        {initialPost && (
          <div className="flex justify-center border-t border-[#E8E1D8] pt-5">
            <DeletePostButton postId={initialPost.postId} />
          </div>
        )}
      </div>
    </div>
  );
}
