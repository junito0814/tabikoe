/**
 * F-VW-03 コメントの入力規則（要件定義書3.5.3）
 */
export const MAX_COMMENT_LENGTH = 4000;

/** 1回に返す件数 */
export const COMMENTS_PAGE_SIZE = 20;

/** 1ユーザーにつき1分間5件まで */
export const COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60;
export const COMMENT_RATE_LIMIT_MAX_ATTEMPTS = 5;
