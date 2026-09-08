"use client";

import { useState, type ChangeEvent } from "react";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

/**
 * F-AC-04 Task5: アイコン画像アップロードUI（SC-07）
 * 出典: docs/tasks/account/profile-edit/05-avatar-upload-ui.md
 */
export default function AvatarUploadForm({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const [previewUrl, setPreviewUrl] = useState(initialAvatarUrl ?? DEFAULT_AVATAR_URL);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWarning(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setWarning("JPEGまたはPNG形式のみアップロードできます");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setWarning("ファイルサイズは10MB以内にしてください");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setWarning(null);

    try {
      const formData = new FormData();
      formData.append("avatar", selectedFile);
      const response = await fetchWithAuthRedirect("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setWarning("アップロードに失敗しました");
        return;
      }

      const data = (await response.json()) as { avatarUrl: string };
      setPreviewUrl(data.avatarUrl);
      setSelectedFile(null);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setWarning("アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt=""
        className="h-20 w-20 rounded-full border border-[#E8E1D8] object-cover"
      />
      <label className="cursor-pointer text-[12px] font-medium text-[#C4703F] underline underline-offset-2">
        画像を選択
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      {warning && <p className="text-[11px] text-[#C4703F]">{warning}</p>}
      {selectedFile && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
          className="h-9 rounded-[8px] bg-[#C4703F] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isUploading ? "アップロード中..." : "アイコンを更新"}
        </button>
      )}
    </div>
  );
}
