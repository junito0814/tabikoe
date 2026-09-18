/**
 * ユーザー表示に関する定数
 * - 退会したユーザーの投稿・コメントは、名前をこの表示名に置き換えて残す（要件定義書 3.2.5）
 * - アイコン未設定・退会後は public/default-avatar.svg を出す
 */
export const DEACTIVATED_DISPLAY_NAME = "退会済みユーザー";
export const DEFAULT_AVATAR_URL = "/default-avatar.svg";
