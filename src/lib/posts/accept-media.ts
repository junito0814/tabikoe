import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "@/lib/video/limits";

/**
 * #861（2026-10-09）: 選んだファイルを受け付けてよいかの判断（純粋関数。約束 13）。
 *
 * 【初心者向け】`accept` 属性は「おすすめ」でしかなく、端末によっては別のものも選べます。
 * ここで断っておかないと、**送り終えてからサーバーに断られる**ことになります（50MB 送ってから、は重い）。
 *
 * **ここで形式（コーデック）の判断はしません。** `.mp4` の中に HEVC が入っていることがあり、
 * iPhone の Safari は HEVC を再生できるので、上げる人の端末では「再生できた」ことになります。
 * 見る人全員が再生できるかは**サーバーが中身を見て**決めます（要件 5.4）。
 * ここは「大きさ」と「長さ」という、端末でも確実に分かることだけを見ます。
 */
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

export type MediaDecision =
  | { kind: "accept" }
  /** 30 秒を超えた動画。切り取りの画面へ送る（要件 4.5.17） */
  | { kind: "needs_trim"; durationSeconds: number }
  | { kind: "reject"; message: string };

/** 秒を「0:42」の形に */
export function formatSeconds(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function decideMedia(input: {
  isVideo: boolean;
  type: string;
  sizeBytes: number;
  /** 動画の長さ。読めなかったときは null（そのときは長さで断らない） */
  durationSeconds: number | null;
  /** 動画の受付を止めているか */
  videoDisabled: boolean;
  /** その端末で切り取れるか。できないなら、長い動画は断って案内する */
  canTrim: boolean;
}): MediaDecision {
  if (!input.isVideo) {
    if (!ALLOWED_PHOTO_TYPES.includes(input.type)) return { kind: "reject", message: "写真は JPEG か PNG だけ投稿できます" };
    if (input.sizeBytes > MAX_PHOTO_SIZE_BYTES) return { kind: "reject", message: "写真は1点あたり10MB以内にしてください" };
    return { kind: "accept" };
  }

  if (input.videoDisabled) return { kind: "reject", message: "動画は近日対応します。いまは写真だけ投稿できます" };

  /*
   * 長さを先に見る。大きさで断ると「短くすれば入るのに、別の動画を選べ」と言ってしまう。
   * 30 秒を超えていても、切り取れる端末なら断らずに切り取りへ送る（要件 4.5.17）。
   */
  if (input.durationSeconds !== null && input.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    if (input.canTrim) return { kind: "needs_trim", durationSeconds: input.durationSeconds };
    return {
      kind: "reject",
      message: `この動画は ${formatSeconds(input.durationSeconds)} です。この端末では切り取れないので、写真アプリで ${MAX_VIDEO_DURATION_SECONDS} 秒以内に編集してから選び直してください`,
    };
  }

  if (input.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
    return { kind: "reject", message: `動画は1点あたり ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB 以内にしてください。短く編集してから選び直してください` };
  }

  return { kind: "accept" };
}
