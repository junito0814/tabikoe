"use client";

import { useEffect, useRef } from "react";

/** 入力が止まってから自動保存するまでの時間 */
export const DRAFT_AUTOSAVE_DELAY_MS = 3000;

/**
 * draft Task2: 下書きの自動保存
 * 出典: docs/tasks/posts/draft/02-draft-ui-autosave.md
 *       要件定義書 v3.0 3.3.7（途中で閉じても自動で下書きに残す）
 *
 * 【初心者向け】ブラウザを閉じる瞬間に通信するのは信頼できない（送り終わる前に閉じられる）ので、
 * 「入力が 3 秒止まるたびに保存する」方式にしている。`snapshot`（入力内容を 1 つの文字列にしたもの）が
 * 変わったときだけタイマーを張り直し、同じ内容なら送らない。未入力（hasInput=false）のときは何もしない。
 * 写真は自動保存しない（容量が大きいため。「下書きに保存」か「投稿する」で上げる）。
 */
export function useDraftAutosave({
  enabled,
  hasInput,
  snapshot,
  save,
}: {
  enabled: boolean;
  hasInput: boolean;
  snapshot: string;
  save: () => Promise<void>;
}) {
  const lastSavedRef = useRef<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled || !hasInput) return;
    if (lastSavedRef.current === snapshot) return;
    const timer = setTimeout(() => {
      const target = snapshot;
      saveRef
        .current()
        .then(() => {
          lastSavedRef.current = target;
        })
        .catch(() => {
          // 自動保存の失敗は画面に出さない（手動の「下書きに保存」で気づける）
        });
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, hasInput, snapshot]);
}
