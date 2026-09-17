/**
 * table-catalog-v3 Task5: レート制限の action 種別（v3.0 で追加した操作）
 * 出典: docs/tasks/data-model/table-catalog-v3/05-rate-limit-actions-and-verification.md
 *       要件定義書 v3.0 7.3
 *
 * 【初心者向け】check_rate_limit() は「subject（誰）× actionType（何を）× 時間枠」で回数を数える。
 * actionType は自由な文字列だが、綴りがずれると別の枠として数えられてしまうため、ここで定数にして共有する。
 * 既存の "login"・"post_creation"・"comment"・"report" は各機能側の定数のまま。
 */
export const RATE_LIMIT_ACTIONS = {
  /** しおりの招待リンク発行：1 ユーザーにつき 1 時間 10 件 */
  itineraryInvite: { actionType: "itinerary_invite", windowSeconds: 3600, limit: 10 },
  /** 下書きの保存（自動保存を含む）：1 ユーザーにつき 1 時間 60 件 */
  draftSave: { actionType: "draft_save", windowSeconds: 3600, limit: 60 },
  /** 「まだあった」報告：1 ユーザーにつき 1 日 50 件 */
  spotStatusReport: { actionType: "spot_status_report", windowSeconds: 86400, limit: 50 },
} as const;

export type RateLimitActionKey = keyof typeof RATE_LIMIT_ACTIONS;
