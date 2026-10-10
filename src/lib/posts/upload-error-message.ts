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
  /** 中身が H.264 ではなかった。iPhone の「高効率」設定が原因であることがほとんど */
  unsupported_codec:
    "この形式の動画は投稿できません。iPhone のカメラ設定を「設定 > カメラ > フォーマット > 互換性優先」にして撮り直すと投稿できます",
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

export function uploadErrorMessage(error: unknown): string {
  return typeof error === "string" ? (UPLOAD_ERROR_MESSAGES[error] ?? DEFAULT_UPLOAD_ERROR_MESSAGE) : DEFAULT_UPLOAD_ERROR_MESSAGE;
}
