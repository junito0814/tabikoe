import {
  announcementSchema,
  firstAnnouncementError,
  type AnnouncementErrorCode,
  type AnnouncementFields,
} from "./announcement-schema";

/**
 * F-AD-03 Task2: お知らせの入力検証（サーバー側の入口）
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md
 *       要件定義書3.10.3（タイトル100文字、本文2,000文字、公開日時）／7.2「入力の検証」
 *
 * 【初心者向け】2026-10-18（#1005）に、**規則そのものを announcement-schema.ts へ移しました**。
 * ここに残っているのは「**ブラウザから来た値を文字列に直して、スキーマに渡す**」だけです。
 *
 * なぜ分けたか: 画面から来る値は必ず文字列（入力欄の中身）ですが、API には**何でも入れられます**。
 * 「文字列かどうか」は**運び方**の話で、「100 文字まで」のような**規則**とは性質が違います。
 * 混ぜると、画面側が規則を読むときに要らない枝を一緒に読むことになります。
 */
export { MAX_ANNOUNCEMENT_BODY_LENGTH, MAX_ANNOUNCEMENT_TITLE_LENGTH } from "./announcement-schema";

export type AnnouncementValidation =
  | { ok: true; fields: AnnouncementFields }
  | { ok: false; error: AnnouncementErrorCode };

export function validateAnnouncementInput(
  input: { title?: unknown; body?: unknown; publishedAt?: unknown },
  /** 公開日時を省略したときに入れる「今」。スキーマの中で時計を読まないため引数で受け取る */
  now: string = new Date().toISOString(),
): AnnouncementValidation {
  const { publishedAt } = input;
  // 文字列でも「未指定」でもないもの（数値・真偽値など）は、日時として読めないので先に断る
  const publishedAtOmitted = publishedAt === undefined || publishedAt === null || publishedAt === "";
  if (!publishedAtOmitted && typeof publishedAt !== "string") {
    return { ok: false, error: "invalid_published_at" };
  }

  const result = announcementSchema(now).safeParse({
    // 文字列以外は「未入力」として扱う（空の文字列にすると、必須の判定で断られる）
    title: typeof input.title === "string" ? input.title : "",
    body: typeof input.body === "string" ? input.body : "",
    publishedAt: publishedAtOmitted ? "" : publishedAt,
  });

  if (!result.success) {
    return { ok: false, error: firstAnnouncementError(result.error.issues) };
  }
  return { ok: true, fields: result.data };
}
