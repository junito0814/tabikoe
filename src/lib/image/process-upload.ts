import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F-AC-04 Task3: 画像アップロード共通処理
 * 出典: docs/tasks/account/profile-edit/03-image-upload-processing-common.md
 *
 * 要件定義書5.4準拠。将来的にF-PO（投稿の写真アップロード）でも再利用する想定の共通モジュール。
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION_PX = 1200;
const ALLOWED_FORMATS = new Set(["jpeg", "png"]);

export class ImageValidationError extends Error {}

export interface ProcessedImageUpload {
  originalUrl: string;
  resizedUrl: string;
}

export async function processAndUploadImage(
  admin: SupabaseClient,
  bucket: string,
  pathPrefix: string,
  file: File
): Promise<ProcessedImageUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ImageValidationError("file_too_large");
  }

  // ファイル拡張子・Content-Typeではなく、実体（マジックバイト）ベースで形式を判定する
  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new ImageValidationError("unsupported_format");
  }

  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new ImageValidationError("unsupported_format");
  }

  const extension = format === "jpeg" ? "jpg" : "png";
  const contentType = format === "jpeg" ? "image/jpeg" : "image/png";

  // .rotate()（引数なし）でEXIF Orientationに従って正しい向きに回転してから、
  // withMetadata()を呼ばずに出力することでGPS等のEXIF情報を除去する
  const encode = (pipeline: ReturnType<typeof sharp>) =>
    format === "jpeg" ? pipeline.jpeg() : pipeline.png();

  const originalBuffer = await encode(sharp(buffer).rotate()).toBuffer();
  const resizedBuffer = await encode(
    sharp(buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
  ).toBuffer();

  const originalPath = `${pathPrefix}/original.${extension}`;
  const resizedPath = `${pathPrefix}/resized.${extension}`;

  const { error: originalError } = await admin.storage
    .from(bucket)
    .upload(originalPath, originalBuffer, { contentType, upsert: true });
  if (originalError) {
    throw originalError;
  }

  const { error: resizedError } = await admin.storage
    .from(bucket)
    .upload(resizedPath, resizedBuffer, { contentType, upsert: true });
  if (resizedError) {
    throw resizedError;
  }

  return {
    originalUrl: admin.storage.from(bucket).getPublicUrl(originalPath).data.publicUrl,
    resizedUrl: admin.storage.from(bucket).getPublicUrl(resizedPath).data.publicUrl,
  };
}
