"use client";

import { useState } from "react";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

const MAX_LENGTH = 200;

/**
 * F-AC-04 Task2: ユーザー名編集UI（SC-07）
 * 出典: docs/tasks/account/profile-edit/02-display-name-edit-ui.md
 */
export default function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [value, setValue] = useState(initialDisplayName);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const length = graphemeLength(value);
  const isTooLong = length > MAX_LENGTH;
  /*
   * #783（2026-10-06）: 「保存」が**何も変えていなくても押せた**。
   * 押しても同じ値を送るだけで、見た目には何も起きないので「効かないボタン」に見える。
   * 変えたときだけ押せるようにする。
   */
  const isUnchanged = value === initialDisplayName;

  const handleSave = async () => {
    if (isTooLong || isSaving) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetchWithAuthRedirect("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: value }),
      });
      setMessage(response.ok ? "保存しました" : "保存に失敗しました");
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[360px]">
      <label className="mb-1.5 block text-[0.75rem] font-medium text-muted">ユーザー名</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.875rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[0.6875rem] ${isTooLong ? "text-accent" : "text-muted"}`}>
          {length} / {MAX_LENGTH}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isTooLong || isSaving || isUnchanged}
          className="h-8 rounded-[8px] bg-accent px-4 text-[0.75rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
      {message && <p className="mt-1.5 text-[0.6875rem] text-muted">{message}</p>}
    </div>
  );
}
