"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TripTitleInput } from "@/components/trips/TripTitleInput";
import { SpotAutocompleteInput } from "@/components/spots/SpotAutocompleteInput";
import { UploadNotice } from "@/components/notices/UploadNotice";
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
 * F-PO-01 Task2: 投稿作成フォームUI（SC-03）
 * 出典: docs/tasks/posts/post-creation/02-post-form-ui.md
 *
 * 旅行タイトル・スポット名は trip-title / spot-selection の成果物を組み込む。
 * 動画は未対応（要件定義書9章#5のffmpeg検証が未了のため、写真のみ先行実装）。
 */
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

export default function PostForm() {
  const router = useRouter();

  const [tripTitle, setTripTitle] = useState("");
  const [spot, setSpot] = useState<RegisteredSpot | null>(null);
  const [category, setCategory] = useState<PostCategory | "">("");
  const [visitDate, setVisitDate] = useState("");
  const [duration, setDuration] = useState<PostDuration | "">("");
  const [cost, setCost] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [photos, setPhotos] = useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const commentLength = graphemeLength(comment);
  const isCommentTooLong = commentLength > MAX_POST_COMMENT_LENGTH;

  const costNumber = cost === "" ? null : Number(cost);
  const isCostInvalid =
    costNumber !== null &&
    (!Number.isInteger(costNumber) || costNumber < MIN_POST_COST || costNumber > MAX_POST_COST);

  const canSubmit =
    tripTitle.trim().length > 0 &&
    spot !== null &&
    category !== "" &&
    duration !== "" &&
    rating > 0 &&
    photos.length > 0 &&
    !isCommentTooLong &&
    !isCostInvalid &&
    !isSubmitting;

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

    try {
      // 先に写真をアップロードし、返ったパスを投稿作成に渡す（要件定義書3.3.1の処理フロー）
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

      const uploaded = (await uploadResponse.json()) as { photos: { storagePath: string }[] };

      const response = await fetchWithAuthRedirect("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripTitle,
          spotId: spot.id,
          category,
          visitDate: visitDate || null,
          duration,
          cost: costNumber,
          rating,
          comment,
          visibility,
          photoPaths: uploaded.photos.map((photo) => photo.storagePath),
        }),
      });

      if (response.status === 429) {
        setErrorMessage("投稿の作成が集中しています。しばらく時間をおいてからお試しください");
        return;
      }
      if (!response.ok) {
        setErrorMessage("投稿の作成に失敗しました。入力内容をご確認ください");
        return;
      }

      // 投稿後の遷移先は要件定義書に定義がない。本来の遷移先になりうる
      // 投稿詳細（SC-05）・マイページ（SC-06）が未実装のため、
      // 暫定でトップページへ戻し、完了したことだけを伝える。
      router.push("/?posted=1");
      router.refresh();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("投稿の作成に失敗しました。入力内容をご確認ください");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-5 bg-[#FBF6F0] px-6 py-12">
      <h1 className="text-[16px] font-bold text-[#3D3A35]">新規投稿</h1>

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
          {isSubmitting ? "投稿中..." : "投稿する"}
        </button>
      </div>
    </div>
  );
}
