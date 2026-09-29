/**
 * 出典: docs/tasks/posts/post-creation-v3/02-form-layout-compaction.md（単体テスト）
 * 「カテゴリ・滞在時間が <select> で 7／5 個の選択肢を持つこと」「注意文が畳まれ、「詳しく」で全文が出ること」
 * 「既存の必須検証（旅行タイトル・スポット・星・写真）が変わらず動くこと」
 */
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_POST_FORM_VALUES, isPostFormComplete, PostFormFields } from "./PostFormFields";

function renderFields(values = EMPTY_POST_FORM_VALUES) {
  return render(
    <PostFormFields
      values={values}
      onChange={vi.fn()}
      spotField={<div data-testid="spot-field" />}
      mediaItems={[]}
      onRemoveMedia={vi.fn()}
      onAddMedia={vi.fn()}
      fileInputRef={createRef<HTMLInputElement>()}
      onFilesSelected={vi.fn()}
      fetchTripSuggestions={async () => []}
    />
  );
}

describe("PostFormFields", () => {
  it("カテゴリは 7 つ、滞在時間は 7 つ（v3.2: …3時間以内／半日／1日／宿泊。「それ以上」は無い）のドロップダウン", () => {
    renderFields();
    const category = screen.getByLabelText("カテゴリ *") as HTMLSelectElement;
    expect(category.options.length - 1).toBe(7);
    const duration = screen.getByLabelText("滞在時間 *") as HTMLSelectElement;
    expect(Array.from(duration.options).slice(1).map((o) => o.value)).toEqual(["30分以内", "1時間以内", "2時間以内", "3時間以内", "半日", "1日", "宿泊"]);
  });

  it("v3.2: カテゴリで「宿泊施設」を選ぶと未選択の滞在時間に「宿泊」が入り、選択済みなら変わらない", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <PostFormFields
        values={{ ...EMPTY_POST_FORM_VALUES }}
        onChange={onChange}
        spotField={<div />}
        mediaItems={[]}
        onRemoveMedia={vi.fn()}
        onAddMedia={vi.fn()}
        fileInputRef={createRef<HTMLInputElement>()}
        onFilesSelected={vi.fn()}
        fetchTripSuggestions={async () => []}
      />
    );
    fireEvent.change(screen.getByLabelText("カテゴリ *"), { target: { value: "宿泊施設" } });
    expect(onChange).toHaveBeenCalledWith({ category: "宿泊施設", duration: "宿泊" });
    unmount();
    const onChange2 = vi.fn();
    render(
      <PostFormFields
        values={{ ...EMPTY_POST_FORM_VALUES, duration: "1時間以内" }}
        onChange={onChange2}
        spotField={<div />}
        mediaItems={[]}
        onRemoveMedia={vi.fn()}
        onAddMedia={vi.fn()}
        fileInputRef={createRef<HTMLInputElement>()}
        onFilesSelected={vi.fn()}
        fetchTripSuggestions={async () => []}
      />
    );
    fireEvent.change(screen.getByLabelText("カテゴリ *"), { target: { value: "宿泊施設" } });
    expect(onChange2).toHaveBeenCalledWith({ category: "宿泊施設" });
  });

  it("注意文は畳まれ、「詳しく」で全文が出る", () => {
    renderFields();
    expect(screen.queryByText(/本人の同意を得てから/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
    expect(screen.getByText(/本人の同意を得てから/)).toBeInTheDocument();
  });

  it("スポット欄は親から差し込まれる", () => {
    renderFields();
    expect(screen.getByTestId("spot-field")).toBeInTheDocument();
  });
});

describe("isPostFormComplete", () => {
  const complete = { ...EMPTY_POST_FORM_VALUES, tripTitle: "旅", category: "グルメ" as const, duration: "1時間以内" as const, visitDate: "2026-09-16", rating: 3 };
  it("必須が揃い写真が 1 点以上なら true", () => {
    expect(isPostFormComplete(complete, 1)).toBe(true);
  });
  it("写真 0 点・星 0・カテゴリ空では false", () => {
    expect(isPostFormComplete(complete, 0)).toBe(false);
    expect(isPostFormComplete({ ...complete, rating: 0 }, 1)).toBe(false);
    expect(isPostFormComplete({ ...complete, category: "" }, 1)).toBe(false);
  });
  // #590: アルバム名は任意（空なら「日常」アルバムに入る。要件 3.3.1・3.3.4）
  it("アルバム名が空でも true（空なら「日常」アルバムに入る）", () => {
    expect(isPostFormComplete({ ...complete, tripTitle: "" }, 1)).toBe(true);
    expect(isPostFormComplete({ ...complete, tripTitle: "   " }, 1)).toBe(true);
  });
  it("滞在時間・訪問日が空なら今までどおり false", () => {
    expect(isPostFormComplete({ ...complete, duration: "" }, 1)).toBe(false);
    expect(isPostFormComplete({ ...complete, visitDate: "" }, 1)).toBe(false);
  });
});
