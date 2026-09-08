/**
 * 投稿時の注意喚起 Task1: 注意喚起メッセージ共通コンポーネント
 * 出典: docs/tasks/shared-ui/upload-notice/01-notice-display.md
 *
 * 組み込み先の投稿作成画面（post-creation）・投稿編集画面（post-edit）はまだ実装されていない
 * （Phase 2、未着手）。それらの実装時に、写真・動画アップロードUIの近傍へこのコンポーネントを
 * 組み込むこと。コンポーネント自体は依存なく完成している。
 */
export function UploadNotice() {
  return (
    <ul className="list-disc space-y-1 pl-4 text-[11px] leading-[1.6] text-[#9C9488]">
      <li>他人が写り込んだ写真・動画は、本人の同意を得てから投稿してください</li>
      <li>個人が特定できる情報（車のナンバー等）が写っていないか確認してください</li>
    </ul>
  );
}
