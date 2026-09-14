"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripTitleInput } from "@/components/trips/TripTitleInput";
import { SpotAutocompleteInput } from "@/components/spots/SpotAutocompleteInput";
import { UploadNotice } from "@/components/notices/UploadNotice";
import { DeletePostButton } from "./DeletePostButton";
import { buildPostedHref } from "@/components/badges/badge-toast-params";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { graphemeLength } from "@/lib/text/grapheme-length";
import type { RegisteredSpot } from "@/lib/spots/types";
import {
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

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

/**
 * SC-03 投稿作成・編集画面
 * 出典: docs/tasks/posts/post-creation/02-post-form-ui.md（F-PO-01 Task2）
 *       docs/tasks/posts/post-edit/03-post-edit-ui.md（F-PO-02 Task3）
 *
 * 3.3.3が「編集可能項目＝投稿の全項目」としており、入力規則も作成時と同じため、
 * 同じフォームを編集モードとして再利用する（initialPostの有無で切り替える）。
 * 旅行タイトル・スポット名は trip-title / spot-selection の成果物を組み込む。
 * 動画は未対応（要件定義書9章#5のffmpeg検証が未了のため、写真のみ先行実装）。
 */
export interface ExistingPhoto {
  id: string;
  url: string;
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

    const invalidType = selected.find((file) => !ALLOWED_PHOTO_TYPES.includes(file.type));
    if (invalidType) {
      setErrorMessage("写真はJPEGまたはPNG形式のみアップロードできます");
      return;
    }
    const tooLarge = selected.find((file) => file.size > MAX_PHOTO_SIZE_BYTES);
    if (tooLarge) {
      setErrorMessage("写真は1点あたり10MB以内にしてください");
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
      // 先に写真をアップロードし、返ったパスを投稿へ渡す（要件定義書3.3.1の処理フロー）
      let uploadedPaths: string[] = [];
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((photo) => formData.append("photos", photo));

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
        uploadedPaths = uploaded.photos.map((photo) => photo.storagePath);
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
        // 追加分の写真を既存投稿へ紐づけてから、本体を更新する
        if (uploadedPaths.length > 0) {
          const attachResponse = await fetchWithAuthRedirect(
            `/api/posts/${initialPost.postId}/photos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photoPaths: uploadedPaths }),
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
      } else {
        const response = await fetchWithAuthRedirect("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, photoPaths: uploadedPaths }),
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
      router.push(initialPost ? "/?updated=1" : buildPostedHref(newBadgeTypes));
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

        <Field label="写真">
          {existingPhotos.length > 0 && (
            <ul className="mb-2 grid grid-cols-3 gap-2">
              {existingPhotos.map((photo) => (
                <li key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt="投稿済みの写真"
                    className="aspect-square w-full rounded-[8px] object-cover"
                  />
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
            accept="image/jpeg,image/png"
            multiple
            onChange={handlePhotoChange}
            className="text-[12px]"
          />
          {photos.length > 0 && (
            <p className="mt-1 text-[11px] text-[#9C9488]">{photos.length}点を選択中</p>
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
