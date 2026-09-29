/**
 * admin-login Task 4: 管理画面の二段階確認の判断（純粋関数）
 * 出典: docs/tasks/admin/admin-login/04-mfa-decision-rules.md
 *       要件定義書 3.10.1「管理者ログイン」（2026-09-29 改訂）・7.2
 *
 * 【初心者向け】管理画面に入れるかどうかの判断を、この 1 ファイルに閉じ込める。
 * 関所（proxy.ts）・二段階確認の画面（SC-32）・重い操作の API の 3 か所が同じ判断を使うため、
 * ここだけをテストすれば足りるようにしている（AGENTS.md 13「判断は純粋関数に切り出す」）。
 * DB・Cookie・画面には触らない。値を受け取って答えを返すだけ。
 */

/**
 * 管理画面へのアクセスをどう扱うか。
 * - `not_found`: 404 を返す（管理者でない人には、二段階確認の画面の存在すら知らせない）
 * - `enroll`:    認証アプリをまだ登録していない → SC-32 の「登録」へ
 * - `verify`:    登録済みだが 6 桁が要る → SC-32 の「確認」へ
 * - `allow`:     そのまま通す
 */
export type AdminGateDecision = "not_found" | "enroll" | "verify" | "allow";

export interface AdminGateInput {
  /** users.is_admin。true 以外はすべて 404 */
  isAdmin: boolean;
  /**
   * ログイン情報（JWT）の `aal` クレーム。
   * 【初心者向け】aal は「どれくらい強く本人確認したか」の段階。Google ログインだけなら `aal1`、
   * 認証アプリの 6 桁まで通ると `aal2` になる。Supabase の JWT では必須項目なので、
   * 関所は手元の署名検証（getClaims）だけで読める＝Supabase への通信が増えない（要件 7.1）。
   */
  aal: string | null | undefined;
  /** 確認済みの認証アプリ（TOTP factor）を持っているか */
  hasFactor: boolean;
  /** 最後に 6 桁を通した時刻（ミリ秒）。無ければ null */
  verifiedAt: number | null | undefined;
  /** 今の時刻（ミリ秒） */
  now: number;
}

/** 管理画面の閲覧を許す時間。これを過ぎたら SC-32 で聞き直す（要件 3.10.1） */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60;

/** 重い操作の前の再確認を省ける時間（要件 3.10.1。GitHub の sudo mode と同じ考え方） */
export const ADMIN_STEP_UP_MAX_AGE_SECONDS = 10 * 60;

/** aal が「6 桁まで通った」段階かどうか */
const AAL2 = "aal2";

/**
 * 「at から now までが maxAgeSeconds 以内か」。
 *
 * 【初心者向け】ここが二段階確認の寿命の判定そのもの。安全側に倒すため、
 * 分からない値（null・数値でない・未来の時刻）はすべて「以内ではない」と答える。
 * 未来を弾くのは、Cookie の時刻を書き換えて期限を延ばされるのを防ぐため。
 */
function isWithin(maxAgeSeconds: number, at: number | null | undefined, now: number): boolean {
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  if (!Number.isFinite(now)) return false;
  const elapsed = now - at;
  if (elapsed < 0) return false; // 未来の時刻は信用しない
  return elapsed <= maxAgeSeconds * 1000;
}

/**
 * 管理画面へのアクセスをどう扱うか決める。
 *
 * 判断の順番は固定する。`isAdmin` を最優先で見るのは、管理者でない人に
 * 「二段階確認の画面がある」ことすら知らせないため（要件 3.10.1・8 章 81）。
 */
export function adminGateDecision(input: AdminGateInput): AdminGateDecision {
  if (!input.isAdmin) return "not_found";
  if (!input.hasFactor) return "enroll";
  if (input.aal !== AAL2) return "verify";
  if (!isWithin(ADMIN_SESSION_MAX_AGE_SECONDS, input.verifiedAt, input.now)) return "verify";
  return "allow";
}

export interface StepUpInput {
  /** 最後に 6 桁を通した時刻（ミリ秒） */
  lastVerifiedAt: number | null | undefined;
  /** 今の時刻（ミリ秒） */
  now: number;
}

/**
 * 取り消せない操作の前に 6 桁を聞き直す必要があるか。
 * 対象の操作は要件 3.10.1（削除／停止・解除・仮停止の確定・取り消し／ストライクの取り消し／規約の公開）。
 */
export function needsStepUp(input: StepUpInput): boolean {
  return !isWithin(ADMIN_STEP_UP_MAX_AGE_SECONDS, input.lastVerifiedAt, input.now);
}
