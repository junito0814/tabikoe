"use client";

import { TripTitleInput } from "@/components/trips/TripTitleInput";
import { UploadNotice } from "@/components/notices/UploadNotice";
import {
  SelectedMediaThumbnails,
  type SelectedMedia,
} from "@/components/media/SelectedMediaThumbnails";
import { graphemeLength } from "@/lib/text/grapheme-length";
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
  autoDurationForCategory,
} from "@/lib/posts/constants";

/**
 * post-creation-v3 Task2: 投稿フォームの項目（配置を 2 列・横並びに詰めた版）
 * 出典: docs/tasks/posts/post-creation-v3/02-form-layout-compaction.md
 *       要件定義書 v3.0 3.3.1「画面構成」
 *
 * 【初心者向け】v1 の PostForm から「項目の描画」だけを取り出した部品。state は持たず、値と onChange を
 * 親（PostComposeScreen）から受け取る（制御コンポーネント）。項目・順序・必須条件は v1 と同じで、変えたのは配置だけ:
 *   - 旅行タイトル・スポット名はラベルと入力欄を横並び（スポット名は SpotField を親が差し込む）
 *   - 日付／滞在時間、費用／星評価は 2 列
 *   - カテゴリ・滞在時間はドロップダウン
 *   - 注意文は 1 行に畳んで「詳しく」で全文、感想は 2 行から伸びる、公開設定は感想のラベル行の右端
 */
export interface PostFormValues {
  tripTitle: string;
  category: PostCategory | "";
  visitDate: string;
  duration: PostDuration | "";
  cost: string;
  rating: number;
  comment: string;
  visibility: PostVisibility;
}

export const EMPTY_POST_FORM_VALUES: PostFormValues = {
  tripTitle: "",
  category: "",
  visitDate: "",
  duration: "",
  cost: "",
  rating: 0,
  comment: "",
  visibility: "public",
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.875rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent";
const smallInputClass =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.8125rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent";

/** 星評価（1〜5）。5 個のボタンを並べ、押した番号を onChange で親へ返す。role="radio" は読み上げ用 */
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className="flex h-10 items-center gap-0.5"
      role="radiogroup"
      aria-label="星評価"
    >
      {Array.from({ length: MAX_POST_RATING }, (_, index) => index + 1).map(
        (star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star}`}
            onClick={() => onChange(star)}
            className="text-[1.5rem] leading-none"
            style={{ color: star <= value ? "var(--star)" : "var(--line)" }}
          >
            ★
          </button>
        ),
      )}
    </div>
  );
}

export function PostFormFields({
  values,
  onChange,
  videoUploadDisabled = true,
  spotField,
  mediaItems,
  onRemoveMedia,
  removingMediaKey = null,
  onAddMedia,
  fileInputRef,
  onFilesSelected,
  fetchTripSuggestions,
  suggestedCategory = null,
}: {
  values: PostFormValues;
  onChange: (patch: Partial<PostFormValues>) => void;
  /**
   * #794（2026-10-06）: カテゴリの「おすすめ」。出すかどうかの判断は
   * `lib/posts/suggested-category.ts` が済ませてあるので、ここは**あれば出す**だけ。
   */
  suggestedCategory?: PostCategory | null;
  /**
   * #861: 動画の受付を止めているか。止めている間は「写真」とだけ書き、
   * ファイル選択からも動画を外す（出せないものを書かない）。
   */
  videoUploadDisabled?: boolean;
  /** スポット名欄（SpotField）。親が地図の状態と合わせて渡す */
  spotField: React.ReactNode;
  mediaItems: SelectedMedia[];
  onRemoveMedia: (key: string) => void;
  /** loading-feedback Task 3: 消している最中の写真 */
  removingMediaKey?: string | null;
  onAddMedia: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fetchTripSuggestions?: React.ComponentProps<
    typeof TripTitleInput
  >["fetchSuggestions"];
}) {
  const commentLength = graphemeLength(values.comment);
  const isCommentTooLong = commentLength > MAX_POST_COMMENT_LENGTH;
  const costNumber = values.cost === "" ? null : Number(values.cost);
  const isCostInvalid =
    costNumber !== null &&
    (!Number.isInteger(costNumber) ||
      costNumber < MIN_POST_COST ||
      costNumber > MAX_POST_COST);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* 旅行タイトル: ラベルと入力欄を横並び */}
      <TripTitleInput
        value={values.tripTitle}
        onChange={(tripTitle) => onChange({ tripTitle })}
        fetchSuggestions={fetchTripSuggestions}
        layout="inline"
      />

      {spotField}

      {/* カテゴリ: ドロップダウン（7 つ）。#798: ラベルは欄の上（画面の中で型を揃える） */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="post-category"
          className="text-[0.75rem] font-medium text-muted"
        >
          カテゴリ *
        </label>
        <select
          id="post-category"
          value={values.category}
          onChange={(event) => {
            const category = event.target.value as PostCategory;
            // v3.2: 「宿泊施設」を選んだとき滞在時間が未選択なら「宿泊」を入れる（変更は可）
            const auto = autoDurationForCategory(category, values.duration);
            onChange(auto ? { category, duration: auto } : { category });
          }}
          className={inputClass}
        >
          <option value="">選択してください</option>
          {POST_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {/*
          * #794: 既存のスポットに投稿するとき、そのスポットの代表カテゴリを 1 つ勧める。
          * **勝手には入れない**（外れたまま投稿されるのを防ぐ）。押した人が入れる。
          * 押すと欄に入り、この行は消える（`suggestedCategory` が null になるため）。
          */}
        {suggestedCategory && (
          <button
            type="button"
            onClick={() => {
              const auto = autoDurationForCategory(suggestedCategory, values.duration);
              onChange(auto ? { category: suggestedCategory, duration: auto } : { category: suggestedCategory });
            }}
            data-suggested-category
            className="tap-target flex w-fit items-center gap-1.5 text-[0.6875rem] text-muted"
          >
            <span className="rounded-full bg-tint px-2 py-0.5 font-bold text-accent">おすすめ</span>
            <span className="font-medium text-ink underline underline-offset-2">{suggestedCategory}</span>
          </button>
        )}
      </div>

      {/* 日付 ／ 滞在時間: 2 列 */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[0.6875rem] text-muted">
          日付 *
          <input
            type="date"
            value={values.visitDate}
            max={todayInJst()}
            onChange={(event) => onChange({ visitDate: event.target.value })}
            className={smallInputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.6875rem] text-muted">
          滞在時間 *
          <select
            value={values.duration}
            onChange={(event) =>
              onChange({ duration: event.target.value as PostDuration })
            }
            className={smallInputClass}
          >
            <option value="">選択</option>
            {POST_DURATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 費用 ／ 星評価: 2 列 */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[0.6875rem] text-muted">
          費用（任意・1人あたり）
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-muted">
              ¥
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_POST_COST}
              max={MAX_POST_COST}
              step={1}
              value={values.cost}
              onChange={(event) => onChange({ cost: event.target.value })}
              aria-label="費用（円・1人あたり）"
              className={`${smallInputClass} pl-7`}
            />
          </span>
          {isCostInvalid && (
            <span className="text-[0.6875rem] text-saved">
              0〜{MAX_POST_COST.toLocaleString()}の整数で入力してください
            </span>
          )}
        </label>
        <div className="flex flex-col gap-1 text-[0.6875rem] text-muted">
          星評価 *
          <StarRating
            value={values.rating}
            onChange={(rating) => onChange({ rating })}
          />
        </div>
      </div>

      {/*
        * 写真: 選んだその場にサムネイル。
        *
        * 2026-10-07: 「写真・動画」→「写真」にした（#861）。出せないものを書くと、
        *   選べると思って動画を選び、投稿のところで初めて断られていたため。
        * **2026-10-10: 戻した（#861）。** ブラウザ側の切り取り（#916）まで入ったので、受け付けを開ける。
        *   `videoUploadDisabled` が true のときは、選んだ時点で `decideMedia` が断る。
        */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] font-medium text-muted">{videoUploadDisabled ? "写真 *" : "写真・動画 *"}</span>
        <SelectedMediaThumbnails
          items={mediaItems}
          onRemove={onRemoveMedia}
          removingKey={removingMediaKey}
          onAdd={onAddMedia}
          addLabel={videoUploadDisabled ? "写真を追加" : "写真・動画を追加"}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={videoUploadDisabled ? "image/jpeg,image/png" : "image/jpeg,image/png,video/mp4,video/quicktime,.mov"}
          multiple
          onChange={onFilesSelected}
          aria-label={videoUploadDisabled ? "写真を選択" : "写真・動画を選択"}
          className="sr-only"
        />
        <UploadNotice compact videoEnabled={!videoUploadDisabled} />
      </div>

      {/* 感想（2 行から伸びる）と公開設定（ラベル行の右端） */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center">
          <label
            htmlFor="post-comment"
            className="flex-1 text-[0.75rem] font-medium text-muted"
          >
            感想（任意）
          </label>
          <select
            value={values.visibility}
            onChange={(event) =>
              onChange({ visibility: event.target.value as PostVisibility })
            }
            aria-label="公開設定"
            className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[0.75rem] text-ink"
          >
            <option value="public">公開</option>
            <option value="private">非公開</option>
          </select>
        </div>
        <textarea
          id="post-comment"
          value={values.comment}
          onChange={(event) => onChange({ comment: event.target.value })}
          rows={2}
          onInput={(event) => {
            const element = event.currentTarget;
            element.style.height = "auto";
            element.style.height = `${element.scrollHeight}px`;
          }}
          className="w-full resize-none rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.875rem] leading-[1.7] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p
          className={`text-right text-[0.6875rem] ${isCommentTooLong ? "text-saved" : "text-muted"}`}
        >
          {commentLength} / {MAX_POST_COMMENT_LENGTH}
        </p>
      </div>
    </div>
  );
}

/** 親が「投稿する」を押せるかの判定に使う（項目の規則は v1 と同じ） */
export function isPostFormComplete(
  values: PostFormValues,
  mediaCount: number,
): boolean {
  const costNumber = values.cost === "" ? null : Number(values.cost);
  const isCostInvalid =
    costNumber !== null &&
    (!Number.isInteger(costNumber) ||
      costNumber < MIN_POST_COST ||
      costNumber > MAX_POST_COST);
  return (
    // #590: アルバム名は任意（空なら「日常」アルバムに入る。要件 3.3.1・3.3.4）。ここで必須にしていたため、
    // 入力欄に「空なら『日常』に入ります」と出ているのに「投稿する」が押せなかった
    values.category !== "" &&
    values.duration !== "" &&
    values.visitDate.length > 0 &&
    values.rating > 0 &&
    mediaCount > 0 &&
    graphemeLength(values.comment) <= MAX_POST_COMMENT_LENGTH &&
    !isCostInvalid
  );
}

