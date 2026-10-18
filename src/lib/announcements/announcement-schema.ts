import { z } from "zod";
import { graphemeLength } from "@/lib/text/grapheme-length";

/**
 * お知らせの入力規則（スキーマ）
 * 出典: #1005「お知らせの入力を、スキーマ＋react-hook-form にする」
 *       要件定義書 3.10.3（タイトル 100 文字・本文 2,000 文字・公開日時）／7.2「入力の検証」
 *
 * 【初心者向け】**規則が書いてあるのはこのファイルだけ**です。
 * サーバー（Route Handlers）と画面（AnnouncementManager）の両方がこれを読みます。
 * 以前は同じ規則とメッセージ文が画面側にも書かれていて、片方だけ直すとずれる状態でした。
 *
 * ここに書かないものが 2 つあります（要件定義書 7.2）。
 *   1. **現在時刻** … 公開日時を省略したときに入れる「今」は、引数 `now` で受け取る
 *   2. **文字列かどうかの確認** … ブラウザから来た値を文字列に直すのは「運び方」の話なので、
 *      サーバー側の入口（validate-announcement.ts）で行う。ここは文字列が来る前提で規則だけを書く
 */

export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 100;
export const MAX_ANNOUNCEMENT_BODY_LENGTH = 2000;

/**
 * 断る理由と、**画面に出す文**の対応表。
 *
 * 【初心者向け】左の合言葉はサーバーが応答に入れるもの、右の文は画面に出すものです。
 * 1 つの表にしておけば、文を直したいときに探す場所が 1 か所になります。
 */
export const ANNOUNCEMENT_ERRORS = {
  title_required: "タイトルを入力してください",
  title_too_long: `タイトルは${MAX_ANNOUNCEMENT_TITLE_LENGTH}文字までです`,
  body_required: "本文を入力してください",
  body_too_long: `本文は${MAX_ANNOUNCEMENT_BODY_LENGTH.toLocaleString("ja-JP")}文字までです`,
  invalid_published_at: "公開日時を選び直してください",
} as const;

export type AnnouncementErrorCode = keyof typeof ANNOUNCEMENT_ERRORS;

/** 複数おかしいときに、どれを先に返すか（作り替える前の検証と同じ順番） */
const ERROR_PRIORITY: readonly AnnouncementErrorCode[] = [
  "title_required",
  "title_too_long",
  "body_required",
  "body_too_long",
  "invalid_published_at",
];

/** 文字数の規則（タイトルと本文で同じ形。必須 → 上限の順に見る） */
function text(required: AnnouncementErrorCode, tooLong: AnnouncementErrorCode, max: number) {
  return (
    z
      .string()
      // 前後の空白は入力の一部として扱わない（空白だけの入力は「未入力」）
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, { error: ANNOUNCEMENT_ERRORS[required] })
      // 【初心者向け】`graphemeLength` は「人が 1 文字と数える単位」で数えます。
      // 組み込みの最大長だと、絵文字 1 つが 11 文字と数えられてしまいます（要件定義書 7.2）
      .refine((value) => graphemeLength(value) <= max, { error: ANNOUNCEMENT_ERRORS[tooLong] })
  );
}

/**
 * お知らせのスキーマ。「今」は外から渡す。
 *
 * 画面の入力欄がそのまま入力の形（すべて文字列）になっている ──
 * 公開日時は `<input type="datetime-local">` が返す「ローカル時刻の文字列」で、
 * 空なら `now` を使い、通ったら ISO 形式（UTC）にそろえて返す。
 */
export function announcementSchema(now: string) {
  return z.object({
    title: text("title_required", "title_too_long", MAX_ANNOUNCEMENT_TITLE_LENGTH),
    body: text("body_required", "body_too_long", MAX_ANNOUNCEMENT_BODY_LENGTH),
    publishedAt: z
      .string()
      .transform((value) => (value === "" ? now : value))
      .refine((value) => !Number.isNaN(Date.parse(value)), { error: ANNOUNCEMENT_ERRORS.invalid_published_at })
      .transform((value) => new Date(value).toISOString()),
  });
}

/** 画面のフォームが持つ値の形（すべて文字列） */
export type AnnouncementFormValues = z.input<ReturnType<typeof announcementSchema>>;

/** 通ったあとの形（保存する値） */
export type AnnouncementFields = z.output<ReturnType<typeof announcementSchema>>;

/** 集まったエラーから、先に返すべき 1 つの合言葉を選ぶ */
export function firstAnnouncementError(issues: readonly z.core.$ZodIssue[]): AnnouncementErrorCode {
  const codes = issues.map((issue) => codeOfIssue(issue));
  for (const candidate of ERROR_PRIORITY) {
    if (codes.includes(candidate)) return candidate;
  }
  return "invalid_published_at";
}

/** 1 件のエラーを合言葉に直す（文で引けないときは、どの欄かで決める） */
function codeOfIssue(issue: z.core.$ZodIssue): AnnouncementErrorCode | undefined {
  const byMessage = (Object.keys(ANNOUNCEMENT_ERRORS) as AnnouncementErrorCode[]).find(
    (code) => ANNOUNCEMENT_ERRORS[code] === issue.message,
  );
  if (byMessage) return byMessage;
  const field = String(issue.path[0] ?? "");
  if (field === "title") return "title_required";
  if (field === "body") return "body_required";
  if (field === "publishedAt") return "invalid_published_at";
  return undefined;
}
