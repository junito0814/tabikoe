import { graphemeLength } from "@/lib/text/grapheme-length";

/**
 * F-AD-03 Task2: お知らせの入力規則
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md
 *       要件定義書3.10.3（タイトル100文字、本文2,000文字、公開日時）
 */
export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 100;
export const MAX_ANNOUNCEMENT_BODY_LENGTH = 2000;

export type AnnouncementValidation =
  | { ok: true; fields: { title: string; body: string; publishedAt: string } }
  | {
      ok: false;
      error: "title_required" | "title_too_long" | "body_required" | "body_too_long" | "invalid_published_at";
    };

export function validateAnnouncementInput(input: {
  title?: unknown;
  body?: unknown;
  publishedAt?: unknown;
}): AnnouncementValidation {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";

  if (title.length === 0) return { ok: false, error: "title_required" };
  if (graphemeLength(title) > MAX_ANNOUNCEMENT_TITLE_LENGTH) return { ok: false, error: "title_too_long" };
  if (body.length === 0) return { ok: false, error: "body_required" };
  if (graphemeLength(body) > MAX_ANNOUNCEMENT_BODY_LENGTH) return { ok: false, error: "body_too_long" };

  // 公開日時は省略可（省略時は今）。指定するなら日時として解釈できること
  let publishedAt: string;
  if (input.publishedAt === undefined || input.publishedAt === null || input.publishedAt === "") {
    publishedAt = new Date().toISOString();
  } else if (typeof input.publishedAt === "string" && !Number.isNaN(Date.parse(input.publishedAt))) {
    publishedAt = new Date(input.publishedAt).toISOString();
  } else {
    return { ok: false, error: "invalid_published_at" };
  }

  return { ok: true, fields: { title, body, publishedAt } };
}
