"use client";

import { useState, type FormEvent } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import {
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "@/lib/announcements/validate-announcement";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { useConfirm } from "@/components/ui/ConfirmSheet";
import { formatDateTime } from "@/lib/format/date-time";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementApi {
  create: (input: { title: string; body: string; publishedAt: string }) => Promise<Response>;
  update: (id: string, input: { title: string; body: string; publishedAt: string }) => Promise<Response>;
  remove: (id: string) => Promise<Response>;
}

/** `<input type="datetime-local">` 用（ローカル時刻の YYYY-MM-DDTHH:mm） */
function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * F-AD-03 Task3: お知らせ管理画面（SC-17）
 * 出典: docs/tasks/admin/announcement-management/03-announcement-management-ui.md
 *
 * 一覧・新規作成フォーム・編集・削除。文字数超過時は送信をブロックしてエラーを表示する。
 *
 * 【初心者向け】1 つのフォームを「新規作成」と「編集」で使い回す。`editingId` が null なら新規、
 * 値があればその id のお知らせを編集中。保存後は一覧の state を直接書き換えて再取得を省いている。
 * 公開日時は `<input type="datetime-local">` が「ローカル時刻の文字列」しか扱えないため、
 * 表示時は toLocalInputValue で ISO → ローカル文字列に、保存時は new Date(...).toISOString() で戻す。
 */
export function AnnouncementManager({
  initialAnnouncements,
  api = defaultApi,
}: {
  initialAnnouncements: Announcement[];
  /** 差し替え口（単体テスト用） */
  api?: AnnouncementApi;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  // 「予約」表示の基準時刻。描画中に Date.now() を呼ばないよう state に持つ
  const [now] = useState(() => Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  // #778: 確認はブラウザ標準の箱ではなく、アプリ共通のシートで聞く
  const { confirm, confirmSheet } = useConfirm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishedAt, setPublishedAt] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const titleLength = graphemeLength(title);
  const bodyLength = graphemeLength(body);
  const titleTooLong = titleLength > MAX_ANNOUNCEMENT_TITLE_LENGTH;
  const bodyTooLong = bodyLength > MAX_ANNOUNCEMENT_BODY_LENGTH;
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !titleTooLong && !bodyTooLong && !isSubmitting;

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPublishedAt(toLocalInputValue(new Date().toISOString()));
  };

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setBody(announcement.body);
    setPublishedAt(toLocalInputValue(announcement.published_at));
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (titleTooLong || bodyTooLong) {
      setErrorMessage(
        titleTooLong
          ? `タイトルは${MAX_ANNOUNCEMENT_TITLE_LENGTH}文字までです`
          : `本文は${MAX_ANNOUNCEMENT_BODY_LENGTH.toLocaleString("ja-JP")}文字までです`
      );
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const input = { title: title.trim(), body: body.trim(), publishedAt: new Date(publishedAt).toISOString() };
    try {
      const response = editingId ? await api.update(editingId, input) : await api.create(input);
      if (!response.ok) {
        setErrorMessage("お知らせを保存できませんでした");
        return;
      }
      const data = (await response.json()) as { announcement: Announcement };
      setAnnouncements((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? data.announcement : item))
          : [data.announcement, ...current]
      );
      resetForm();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("お知らせを保存できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除はブラウザ標準の confirm で確認してから API を呼ぶ。編集中のものを消したらフォームも空に戻す
  const handleDelete = async (announcement: Announcement) => {
    if (!(await confirm({ title: `「${announcement.title}」を削除しますか？`, description: "利用者の通知からも消えます。", confirmLabel: "削除", danger: true }))) return;
    setErrorMessage(null);
    try {
      const response = await api.remove(announcement.id);
      if (!response.ok) {
        setErrorMessage("お知らせを削除できませんでした");
        return;
      }
      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
      if (editingId === announcement.id) resetForm();
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("お知らせを削除できませんでした");
    }
  };

  return (
    <div className="flex w-full flex-col">
      {confirmSheet}
      <div className="flex w-full flex-col gap-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4">
          <h2 className="text-[0.8125rem] font-bold text-ink">{editingId ? "お知らせを編集" : "新しいお知らせ"}</h2>
          <label className="text-[0.75rem] font-medium text-muted">
            タイトル
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={titleTooLong}
              className="mt-1 h-10 w-full rounded-[8px] border border-line px-3 text-[0.875rem] text-ink"
            />
            <span className={`mt-0.5 block text-[0.6875rem] ${titleTooLong ? "text-accent" : "text-muted"}`}>
              {titleLength}/{MAX_ANNOUNCEMENT_TITLE_LENGTH}
            </span>
          </label>
          <label className="text-[0.75rem] font-medium text-muted">
            本文
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              aria-invalid={bodyTooLong}
              className="mt-1 w-full rounded-[8px] border border-line px-3 py-2 text-[0.875rem] text-ink"
            />
            <span className={`mt-0.5 block text-[0.6875rem] ${bodyTooLong ? "text-accent" : "text-muted"}`}>
              {bodyLength.toLocaleString("ja-JP")}/{MAX_ANNOUNCEMENT_BODY_LENGTH.toLocaleString("ja-JP")}
            </span>
          </label>
          <label className="text-[0.75rem] font-medium text-muted">
            公開日時
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(event) => setPublishedAt(event.target.value)}
              className="mt-1 h-10 w-full rounded-[8px] border border-line px-3 text-[0.875rem] text-ink"
            />
          </label>

          {errorMessage && <ErrorNotice message={errorMessage} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-[8px] bg-accent px-4 text-[0.8125rem] font-semibold text-white disabled:opacity-45"
            >
              {isSubmitting ? "保存中…" : editingId ? "更新する" : "作成する"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="h-10 rounded-[8px] border border-line bg-surface px-4 text-[0.8125rem] text-ink">
                編集をやめる
              </button>
            )}
          </div>
        </form>

        <section aria-labelledby="announcements-heading">
          <h2 id="announcements-heading" className="mb-2 text-[0.8125rem] font-bold text-ink">配信済み・予約中のお知らせ</h2>
          {announcements.length === 0 ? (
            <p className="py-8 text-center text-[0.75rem] text-muted">お知らせはまだありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {announcements.map((announcement) => (
                <li key={announcement.id} className="rounded-[12px] border border-line bg-surface p-3" data-announcement={announcement.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-semibold text-ink">{announcement.title}</p>
                      <p className="text-[0.6875rem] text-muted">
                        公開 {formatDateTime(announcement.published_at)}
                        {Date.parse(announcement.published_at) > now && "（予約）"}
                      </p>
                    </div>
                    <span className="flex shrink-0 gap-3 text-[0.75rem]">
                      <button type="button" onClick={() => startEdit(announcement)} className="font-medium text-ink underline underline-offset-2">
                        編集
                      </button>
                      <button type="button" onClick={() => void handleDelete(announcement)} className="font-medium text-accent underline underline-offset-2">
                        削除
                      </button>
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[0.75rem] leading-[1.6] text-ink">{announcement.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const defaultApi: AnnouncementApi = {
  create: (input) =>
    fetchWithAuthRedirect("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  update: (id, input) =>
    fetchWithAuthRedirect(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  remove: (id) => fetchWithAuthRedirect(`/api/admin/announcements/${id}`, { method: "DELETE" }),
};
