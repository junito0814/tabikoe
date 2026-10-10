"use client";

import { useState } from "react";
import { WarningIcon } from "@/components/ui/LineIcons";

/**
 * 投稿時の注意喚起 Task1: 注意喚起メッセージ共通コンポーネント
 * 出典: docs/tasks/shared-ui/upload-notice/01-notice-display.md
 *       docs/tasks/posts/post-creation-v3/02-form-layout-compaction.md（compact: 1 行に畳み「詳しく」で全文）
 *
 * SC-03（投稿作成・編集）の写真・動画欄の近くに置く。`compact` のときは 1 行に畳んで
 * 「詳しく」で全文を出す（スクロールを減らすため。要件定義書 v3.0 3.3.1）。
 */
export function UploadNotice({ compact = false, videoEnabled = false }: { compact?: boolean; /** #861: 動画も受け付けているか。文面を「写真」と「写真・動画」で分ける */ videoEnabled?: boolean }) {
  const [expanded, setExpanded] = useState(!compact);
  if (!expanded) {
    return (
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
        <WarningIcon />
        写り込み・個人情報に注意
        <button type="button" onClick={() => setExpanded(true)} className="font-medium text-accent underline underline-offset-2">
          詳しく
        </button>
      </p>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-[0.6875rem] leading-[1.6] text-muted">
      {/* 2026-10-07 に「写真」だけへ → 2026-10-10 に動画を受け付けたら戻す（#861） */}
      <li>他人が写り込んだ{videoEnabled ? "写真・動画" : "写真"}は、本人の同意を得てから投稿してください</li>
      <li>個人が特定できる情報（車のナンバー等）が写っていないか確認してください</li>
    </ul>
  );
}
