/**
 * #861（2026-10-09）: アップロードが断られた理由を、**直し方が分かる文**にする。
 *
 * 【初心者向け】それまではどんな理由でも「写真のアップロードに失敗しました」の 1 文でした。
 * 利用者には**何が悪かったのか、次に何をすればよいのか**が分かりません。
 * とくに動画は「形式が違う」が起こりえて、しかも**設定を変えれば直せます**。
 * 黙って断るのではなく、直し方まで伝えます（要件 4.5.4 エラー表示）。
 *
 * 判断はここだけ（約束 13）。サーバーが返す合言葉（`error`）を文に直すだけの純粋関数。
 */
export const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  /** 中身が H.264 ではなかった。形式が分かるときは `unsupportedCodecMessage` が上書きする */
  unsupported_codec: "この形式の動画は投稿できません。H.264 の MP4 で撮り直すと投稿できます",
  /** 中身を読めなかった（壊れている・動画ではない） */
  unsupported_format: "この動画は読み取れませんでした。別の動画を選んでください",
  /** 30 秒を超えていた。ふつうはブラウザ側で切り取るので、ここまで来るのは切り取れなかったとき */
  video_too_long: "動画は 30 秒以内にしてください。写真アプリで短く編集してから選び直してください",
  file_too_large: "ファイルが大きすぎます。写真は 10MB、動画は 50MB までです。別のものを選ぶか、短く編集してください",
  /** 本番で動画の受付を止めている間（docs/deployment.md の VIDEO_UPLOAD_DISABLED） */
  video_disabled: "動画は近日対応します。いまは写真だけ投稿できます",
  photo_required: "写真か動画を 1 点以上選んでください",
  invalid_path: "アップロードをやり直してください",
  upload_not_found: "アップロードをやり直してください",
};

/** 既定の文。合言葉が分からないときはこれ */
export const DEFAULT_UPLOAD_ERROR_MESSAGE = "アップロードに失敗しました。通信を確かめてもう一度お試しください";

/**
 * iPhone の「高効率」で撮った動画（HEVC）の形式名。ffmpeg が出す名前に合わせる。
 *
 * 【初心者向け】`hevc` が ffmpeg の呼び名で、`hvc1` は MP4 の中に書かれる札です。
 * どちらで来ても同じものとして扱います。
 */
const HEVC_CODECS = new Set(["hevc", "hvc1", "hev1", "h265"]);

/**
 * #904 の調査（2026-10-17）: 形式が分かるときは、その形式に合った直し方を出す。
 *
 * 【初心者向け】いままでは理由が `unsupported_codec` のとき、**どんな形式でも**
 * 「iPhone のカメラ設定を『互換性優先』に」と出していました。
 * **Android から VP9 や AV1 を上げた人には的外れ**です（iPhone を持っていないかもしれません）。
 * HEVC のときだけ iPhone の設定を案内し、それ以外は形式の名前を添えるだけにします。
 */
export function unsupportedCodecMessage(videoCodec: string | null | undefined): string {
  if (videoCodec && HEVC_CODECS.has(videoCodec.toLowerCase())) {
    return "この動画の形式（HEVC）は投稿できません。iPhone のカメラ設定を「設定 > カメラ > フォーマット > 互換性優先」にして撮り直すと投稿できます";
  }
  if (videoCodec) {
    return `この動画の形式（${videoCodec}）は投稿できません。H.264 の MP4 で撮り直すと投稿できます`;
  }
  return UPLOAD_ERROR_MESSAGES.unsupported_codec;
}

/**
 * サーバーが返した合言葉を文に直す。
 *
 * `videoCodec` は `unsupported_codec` のときだけ使う（サーバーが一緒に返してくる）。
 */
export function uploadErrorMessage(error: unknown, videoCodec?: string | null): string {
  if (typeof error !== "string") return DEFAULT_UPLOAD_ERROR_MESSAGE;
  if (error === "unsupported_codec") return unsupportedCodecMessage(videoCodec);
  return UPLOAD_ERROR_MESSAGES[error] ?? DEFAULT_UPLOAD_ERROR_MESSAGE;
}
