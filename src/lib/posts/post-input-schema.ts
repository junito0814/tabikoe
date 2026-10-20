import { z } from "zod";
import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  MAX_POST_RATING,
  MIN_POST_COST,
  MIN_POST_RATING,
  POST_CATEGORIES,
  POST_DURATIONS,
  POST_STATUSES,
  POST_VISIBILITIES,
} from "./constants";

/**
 * 投稿の入力規則（スキーマ）
 * 出典: #993「投稿の入力検証を 1 つのスキーマにまとめる」／方針は要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】ここは「**送られてきた値がこの形か**」だけを書く場所です。
 * サーバー（Route Handlers）と画面の両方がこの 1 つを読むので、
 * 規則が 2 か所に分かれてずれることがなくなります（AGENTS.md 14）。
 *
 * 書かないものが 3 つあります。理由も要件定義書 7.2 に書いてあります。
 *   1. **DB を見る判定**（重複・権限・公開済みか）… 非同期になり、同期の呼び出しが実行時に止まる
 *   2. **現在時刻**… 器を静的に作れなくなる（#901）。「今日」は引数で受け取る
 *   3. **文字数を数える組み込みの上限**… 絵文字を 11 文字と数えてしまうので `graphemeLength` を使う
 */

/** 未入力とみなす値。画面は未選択を `""`、API は省略を `undefined` で送ってくる */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * 「未入力なら既定値、入っていれば選択肢のどれか」
 *
 * 【初心者向け】`z.unknown()` で何でも受けてから `transform` で既定値に差し替え、
 * `pipe` で「次の検査にかける」と読みます。差し替えてから検査するので、
 * 既定値そのものが選択肢に無ければ、そこで気づけます。
 */
function withDefault<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z
    .unknown()
    .transform((value) => (isBlank(value) ? fallback : value))
    .pipe(z.enum(values));
}

/** 「未入力なら null、入っていれば選択肢のどれか」（下書きでは空のままでよい項目） */
function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .unknown()
    .transform((value) => (isBlank(value) ? null : value))
    .pipe(z.enum(values).nullable());
}

/** 緯度・経度。範囲外と、数値でないもの（`"35.6"`・`NaN`・`Infinity`）を断る */
function coordinate(limit: number) {
  return z
    .number()
    .refine((value) => Number.isFinite(value))
    .refine((value) => value >= -limit && value <= limit);
}

/** 訪問日。`YYYY-MM-DD` の形だけを受け、`today` より後（未来）は断る */
function visitDateField(today: string) {
  return z
    .unknown()
    .transform((value) => (isBlank(value) ? null : value))
    .pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        // 【初心者向け】日付の文字列は YYYY-MM-DD なら文字の大小比較がそのまま日付の前後になる
        .refine((value) => value <= today, { error: FUTURE_VISIT_DATE })
        .nullable(),
    );
}

/** 未来日だけは、ほかの形式エラーと区別して返す（画面のメッセージが変わるため） */
const FUTURE_VISIT_DATE = "future_visit_date";

/**
 * 投稿の項目のスキーマ。「今日」は外から渡す（上記 2 の理由）。
 *
 * `status` が `draft` のときは、カテゴリ・滞在時間・星が空でもよい（位置だけの下書きが成立する）。
 * `published` のときに空なら、下の `superRefine` が「必須です」として断る。
 */
export function postFieldsSchema(today: string) {
  /*
   * 【初心者向け】最初に `preprocess` で**投稿の項目だけを抜き出して**います。理由が 2 つあります。
   *
   *   1. 投稿 API は `spotId`・`media` のように**別で使うキーも同じ JSON で**受ける。
   *      ここで抜き出しておけば、スキーマは投稿の項目だけを見ればよい
   *   2. 省略されたキーを `undefined` として**明示的に渡す**ため。
   *      `transform` を通した項目は「キーが無くてもよい」という性質を失い、
   *      省略されたキーがそのままだと「必須です」と断られてしまう（2026-10-18 に実測）
   */
  return z.preprocess(
    (raw) => {
      const input = (raw ?? {}) as Record<string, unknown>;
      return Object.fromEntries(POST_FIELD_KEYS.map((key) => [key, input[key]]));
    },
    z
      .object({
        // 並び順は、おかしいときに返すエラーの優先順（下の ERROR_PRIORITY）と合わせてある
        status: withDefault(POST_STATUSES, "published"),
        lat: coordinate(90),
        lng: coordinate(180),
        visibility: withDefault(POST_VISIBILITIES, "public"),
        category: optionalEnum(POST_CATEGORIES),
        duration: optionalEnum(POST_DURATIONS),
        // 星は 0 を「未入力」として受ける（画面が「星なし」を 0 で送ってくる）
        rating: z
          .unknown()
          .transform((value) => (isBlank(value) || value === 0 ? null : value))
          .pipe(z.number().int().min(MIN_POST_RATING).max(MAX_POST_RATING).nullable()),
        cost: z
          .unknown()
          .transform((value) => (isBlank(value) ? null : value))
          .pipe(z.number().int().min(MIN_POST_COST).max(MAX_POST_COST).nullable()),
        visitDate: visitDateField(today),
        // 感想は文字列以外なら「無かったこと」にする（断らない）
        comment: z
          .unknown()
          .transform((value) => (typeof value === "string" ? value : ""))
          .refine((value) => graphemeLength(value) <= MAX_POST_COMMENT_LENGTH),
      })
      .superRefine((fields, ctx) => {
        // 公開するなら、この 3 つは空のままにできない
        if (fields.status === "draft") return;
        for (const key of ["category", "duration", "rating"] as const) {
          if (fields[key] === null)
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: `${key} is required`,
            });
        }
      })
      .transform((fields) => ({
        ...fields,
        // 公開で訪問日が空なら今日（JST）。下書きは空のままにする
        visitDate: fields.visitDate ?? (fields.status === "published" ? today : null),
        comment: fields.comment.length > 0 ? fields.comment : null,
      })),
  );
}

/** スキーマが見る項目。これ以外のキー（spotId・media など）は投稿の検証では見ない */
const POST_FIELD_KEYS = [
  "status",
  "lat",
  "lng",
  "visibility",
  "category",
  "duration",
  "rating",
  "cost",
  "visitDate",
  "comment",
] as const;

/** 検証に失敗した理由。呼び出し元がそのままレスポンスの error に使う */
export type PostValidationError =
  | "invalid_status"
  | "invalid_location"
  | "invalid_visibility"
  | "invalid_category"
  | "invalid_duration"
  | "invalid_rating"
  | "invalid_cost"
  | "invalid_visit_date"
  | typeof FUTURE_VISIT_DATE
  | "comment_too_long";

/** どの項目のエラーを、どの合言葉で返すか */
const ERROR_OF_FIELD: Record<string, PostValidationError> = {
  status: "invalid_status",
  lat: "invalid_location",
  lng: "invalid_location",
  visibility: "invalid_visibility",
  category: "invalid_category",
  duration: "invalid_duration",
  rating: "invalid_rating",
  cost: "invalid_cost",
  visitDate: "invalid_visit_date",
  comment: "comment_too_long",
};

/**
 * 複数おかしいときに、どれを先に返すか。
 *
 * 【初心者向け】エラーは 1 つだけ返す形なので、**どれを先に返すかも動きの一部**です
 * （画面に出るメッセージが変わります）。スキーマは全部まとめて集めてくるので、
 * ここで順番を決めます。並びは、作り替える前の検証と同じにしてあります。
 */
const ERROR_PRIORITY: readonly PostValidationError[] = [
  "invalid_status",
  "invalid_location",
  "invalid_visibility",
  "invalid_category",
  "invalid_duration",
  "invalid_rating",
  "invalid_cost",
  "invalid_visit_date",
  FUTURE_VISIT_DATE,
  "comment_too_long",
];

/** 集まったエラーから、先に返すべき 1 つを選ぶ */
export function firstPostError(issues: readonly z.core.$ZodIssue[]): PostValidationError {
  const codes = issues.map((issue) =>
    issue.message === FUTURE_VISIT_DATE ? FUTURE_VISIT_DATE : ERROR_OF_FIELD[String(issue.path[0] ?? "")],
  );
  for (const candidate of ERROR_PRIORITY) {
    if (codes.includes(candidate)) return candidate;
  }
  // ここに来るのは、スキーマに項目を足して ERROR_OF_FIELD に書き忘れたときだけ
  return "invalid_status";
}
