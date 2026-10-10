/**
 * #861（2026-10-10）: 動画を受け付けているかで、言葉とファイル選択を切り替える。
 *
 * 【初心者向け】ここで見張るのは「**出せないものを書かない**」です。
 *   2026-10-07 に「写真・動画」と書いてあるのに動画は止まっていて、
 *   選べると思って動画を選ぶと**投稿のところで初めて断られて**いました（#861）。
 *   言葉と `accept` と受付の 3 つは、**必ず一緒に動く**必要があります。
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PostFormFields, EMPTY_POST_FORM_VALUES } from "./PostFormFields";

function setup(videoUploadDisabled: boolean) {
  render(
    <PostFormFields
      values={EMPTY_POST_FORM_VALUES}
      onChange={vi.fn()}
      videoUploadDisabled={videoUploadDisabled}
      spotField={<div />}
      mediaItems={[]}
      onRemoveMedia={vi.fn()}
      onAddMedia={vi.fn()}
      fileInputRef={createRef<HTMLInputElement>()}
      onFilesSelected={vi.fn()}
    />
  );
}

describe("動画を止めているとき", () => {
  it("「写真」とだけ書き、ファイル選択からも動画を外す", () => {
    setup(true);
    expect(screen.getByText("写真 *")).toBeTruthy();
    expect(screen.getByRole("button", { name: "写真を追加" })).toBeTruthy();
    const input = screen.getByLabelText("写真を選択") as HTMLInputElement;
    expect(input.accept).toBe("image/jpeg,image/png");
    // 端末の選択画面に動画が出ない
    expect(input.accept).not.toContain("video");
  });
});

describe("動画を受け付けているとき", () => {
  it("「写真・動画」と書き、MP4 と MOV を選べる", () => {
    setup(false);
    expect(screen.getByText("写真・動画 *")).toBeTruthy();
    expect(screen.getByRole("button", { name: "写真・動画を追加" })).toBeTruthy();
    const input = screen.getByLabelText("写真・動画を選択") as HTMLInputElement;
    expect(input.accept).toContain("video/mp4");
    // iPhone の動画は MOV（video/quicktime）。拡張子も書いておかないと出ない端末がある
    expect(input.accept).toContain("video/quicktime");
    expect(input.accept).toContain(".mov");
  });

  it("注意書きも「写真・動画」になる", () => {
    setup(false);
    // 注意書きは 1 行に畳んであるので、「詳しく」で開いてから見る
    fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
    expect(screen.getByText(/他人が写り込んだ写真・動画は/)).toBeTruthy();
  });
});

describe("既定は止めている", () => {
  it("渡し忘れたら写真だけ ── 事故の向きを安全側にする", () => {
    render(
      <PostFormFields
        values={EMPTY_POST_FORM_VALUES}
        onChange={vi.fn()}
        spotField={<div />}
        mediaItems={[]}
        onRemoveMedia={vi.fn()}
        onAddMedia={vi.fn()}
        fileInputRef={createRef<HTMLInputElement>()}
        onFilesSelected={vi.fn()}
      />
    );
    expect(screen.getByText("写真 *")).toBeTruthy();
  });
});
