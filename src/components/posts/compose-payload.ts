import type { LatLng } from "@/components/map/initial-center";
import type { PostFormValues } from "./PostFormFields";

/** POST /api/posts/photos が返す 1 件分 */
export interface UploadedMedia {
  mediaType: "photo" | "video";
  storagePath: string;
  videoPath: string | null;
  durationSeconds: number | null;
}

/**
 * post-creation-v3 Task3: 画面の state → API に送る JSON
 * 出典: docs/tasks/posts/post-creation-v3/03-split-screen-layout.md
 *
 * 【初心者向け】画面の入力（文字列の cost など）を API が期待する型（数値・null）に直す小さな純粋関数。
 * 単体テストしやすいよう React から切り離してある。
 */
export function buildComposePayload(input: {
  status: "draft" | "published";
  values: PostFormValues;
  position: LatLng;
  spotId: string | null;
  spotName: string;
  media: UploadedMedia[];
}) {
  const { values } = input;
  return {
    status: input.status,
    tripTitle: values.tripTitle,
    spotId: input.spotId,
    spotName: input.spotName.trim() || null,
    category: values.category || null,
    visitDate: values.visitDate || null,
    duration: values.duration || null,
    cost: values.cost === "" ? null : Number(values.cost),
    rating: values.rating > 0 ? values.rating : null,
    comment: values.comment,
    visibility: values.visibility,
    lat: input.position.lat,
    lng: input.position.lng,
    media: input.media,
  };
}
