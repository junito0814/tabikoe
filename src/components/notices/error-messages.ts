/**
 * 共通エラー表示 Task2: 各外部サービス障害時のエラーメッセージ組み込み
 * 出典: docs/tasks/shared-ui/error-display/02-service-specific-error-integration.md
 *       要件定義書6章
 *
 * Google Maps JavaScript API・Google Places APIへの組み込みは、
 * それぞれ地図表示（F-MP-01）・スポット検索（F-MP-02等、Phase 5）が
 * まだ実装されていないため対象外（実装時にこの定数を再利用する）。
 */
export const ERROR_MESSAGES = {
  mapLoadFailure: "地図を読み込めませんでした",
  placeSearchFailure: "スポット検索が一時的に利用できません",
  oauthFailure: "ログインに失敗しました。時間をおいて再度お試しください",
  dbLoadFailure: "データを読み込めませんでした。時間をおいて再度お試しください",
} as const;
