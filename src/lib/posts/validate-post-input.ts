import { firstPostError, postFieldsSchema, type PostValidationError } from "./post-input-schema";
import { todayInJst, type PostCategory, type PostDuration, type PostStatus, type PostVisibility } from "./constants";

/**
 * 投稿の入力検証（要件定義書 v3.0 3.3.1・3.3.7、検証の方針は 7.2「入力の検証」）
 *
 * 投稿作成（post-creation-v3 Task1）・投稿編集（post-edit-v3）・下書き（draft）で同じルールを
 * 適用するため、各 Route Handler から呼び出す共通処理として切り出している。
 *
 * 【初心者向け】2026-10-18（#993）に、**規則そのものを post-input-schema.ts へ移しました**。
 * ここに残っているのは「**スキーマに今日の日付を渡して呼び、結果を今までの形に直す**」だけです。
 * 呼び出し側（Route Handlers）は今までどおり `if (!validation.ok) return 400` と書けます。
 *
 * 戻り値は { ok: true, fields } か { ok: false, error } のどちらか（判別可能なユニオン型）。
 */
export interface ValidatedPostFields {
  status: PostStatus;
  category: PostCategory | null;
  duration: PostDuration | null;
  visibility: PostVisibility;
  rating: number | null;
  cost: number | null;
  visitDate: string | null;
  comment: string | null;
  lat: number;
  lng: number;
}

/** ブラウザから来た値は「何が入っているか分からない」前提で `unknown` 型で受ける */
export interface PostInput {
  status?: unknown;
  category?: unknown;
  duration?: unknown;
  visibility?: unknown;
  rating?: unknown;
  cost?: unknown;
  visitDate?: unknown;
  comment?: unknown;
  lat?: unknown;
  lng?: unknown;
}

export type { PostValidationError };

export type PostValidationResult =
  | { ok: true; fields: ValidatedPostFields }
  | { ok: false; error: PostValidationError };

/**
 * 投稿の項目を確かめる。
 *
 * 【初心者向け】「今日」をここで読んでスキーマに渡しています。
 * スキーマの中で現在時刻を読むと、器を静的に作れなくなるためです（#901・要件定義書 7.2）。
 * テストで日付を固定したい場合は、下の `validatePostInputOn` に今日を渡してください。
 */
export function validatePostInput(input: PostInput): PostValidationResult {
  return validatePostInputOn(input, todayInJst());
}

/** 「今日」を指定して確かめる（訪問日の未来判定に使う）。JST の `YYYY-MM-DD` */
export function validatePostInputOn(input: PostInput, today: string): PostValidationResult {
  const result = postFieldsSchema(today).safeParse(input);
  if (!result.success) {
    return { ok: false, error: firstPostError(result.error.issues) };
  }
  return { ok: true, fields: result.data };
}
