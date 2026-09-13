import { graphemeLength } from "@/lib/text/grapheme-length";
import { MAX_COMMENT_LENGTH } from "./constants";

/**
 * F-VW-03 Task1: コメント本文の検証とエスケープ
 * 出典: docs/tasks/browsing/comments/01-comment-create-handler.md
 *       要件定義書3.5.3（全角4,000文字まで）・7.2（HTMLタグ・スクリプトとして解釈されないようエスケープ）
 */
export type CommentValidation =
  | { ok: true; body: string }
  | { ok: false; error: "body_required" | "body_too_long" };

/** 保存前に HTML の特殊文字を実体参照へ置き換える。表示側は unescapeHtml で文字に戻し、React のテキストとして描画する */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * 文字数は書記素クラスタ単位（絵文字も1文字）で、エスケープ前の入力に対して数える。
 * 前後の空白は落とし、空ならエラー。
 */
export function validateCommentBody(input: unknown): CommentValidation {
  const raw = typeof input === "string" ? input.trim() : "";
  if (raw.length === 0) {
    return { ok: false, error: "body_required" };
  }
  if (graphemeLength(raw) > MAX_COMMENT_LENGTH) {
    return { ok: false, error: "body_too_long" };
  }
  return { ok: true, body: escapeHtml(raw) };
}
