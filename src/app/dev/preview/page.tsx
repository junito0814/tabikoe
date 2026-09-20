import { MapPin } from "@/components/pins/MapPin";
import { MediaGrid, type MediaItem } from "@/components/media/MediaGrid";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { UploadNotice } from "@/components/notices/UploadNotice";
import TripTitlePreview from "./trip-title-preview";
import SpotAutocompletePreview from "./spot-autocomplete-preview";
import GoogleMapPreview from "./google-map-preview";

/**
 * 【一時的な開発用ページ】Phase 0（共通UIコンポーネント）の目視確認用。
 * 組み込み先の実画面（地図・投稿一覧・投稿作成/編集）が実装され、
 * 各コンポーネントが本番画面に組み込まれた時点でこのページ自体は削除すること。
 */

const SAMPLE_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23E8E1D8'/%3E%3C/svg%3E";

function makeItems(count: number, withVideo = false): MediaItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    mediaType: withVideo && i === 0 ? "video" : "photo",
    thumbnailUrl: SAMPLE_PHOTO,
    alt: withVideo && i === 0 ? `サンプル動画${i + 1}` : `サンプル写真${i + 1}`,
    videoUrl: withVideo && i === 0 ? "https://example.com/sample.mp4" : undefined,
  }));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full max-w-[420px]">
      <h2 className="mb-3 text-[14px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentPreviewPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-10 bg-app px-6 py-12">
      <p className="w-full max-w-[420px] rounded-lg bg-ink px-3 py-2 text-[11px] text-on-ink">
        開発用プレビューページ（本番画面には組み込まれていません）
      </p>

      <Section title="map-display: GoogleMap（共通地図コンポーネント）">
        <GoogleMapPreview />
      </Section>

      <Section title="pin-display-rules: MapPin">
        <div className="flex items-center gap-6 rounded-lg border border-line bg-surface p-6">
          <MapPin type="normal" />
          <MapPin type="wishlist" />
          <MapPin type="posted" />
        </div>
      </Section>

      <Section title="media-layout: MediaGrid（1〜4点・6点・動画混在）">
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4, 6].map((count) => (
            <div key={count}>
              <p className="mb-1 text-[11px] text-muted">{count}点</p>
              <MediaGrid items={makeItems(count)} />
            </div>
          ))}
          <div>
            <p className="mb-1 text-[11px] text-muted">動画を含む3点</p>
            <MediaGrid items={makeItems(3, true)} />
          </div>
        </div>
      </Section>

      <Section title="error-display: ErrorNotice">
        <div className="flex flex-col gap-2">
          <ErrorNotice message="地図を読み込めませんでした" />
          <ErrorNotice message="データを読み込めませんでした。時間をおいて再度お試しください" retryable />
        </div>
      </Section>

      <Section title="trip-title: TripTitleInput（候補はサンプルデータ）">
        <TripTitlePreview />
      </Section>

      <Section title="spot-selection: SpotAutocompleteInput（候補はサンプルデータ）">
        <SpotAutocompletePreview />
      </Section>

      <Section title="upload-notice: UploadNotice">
        <div className="rounded-lg border border-line bg-surface p-4">
          <UploadNotice />
        </div>
      </Section>
    </div>
  );
}
