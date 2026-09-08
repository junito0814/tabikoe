"use client";

import { useState } from "react";
import { graphemeLength } from "@/lib/text/grapheme-length";

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

  const handleSave = async () => {
    if (isTooLong || isSaving) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: value }),
      });
      setMessage(response.ok ? "保存しました" : "保存に失敗しました");
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[360px]">
      <label className="mb-1.5 block text-[12px] font-medium text-[#9C9488]">ユーザー名</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-[10px] border border-[#E8E1D8] bg-white px-3 text-[14px] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[11px] ${isTooLong ? "text-[#C4703F]" : "text-[#9C9488]"}`}>
          {length} / {MAX_LENGTH}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isTooLong || isSaving}
          className="h-8 rounded-[8px] bg-[#C4703F] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
      {message && <p className="mt-1.5 text-[11px] text-[#9C9488]">{message}</p>}
    </div>
  );
}
