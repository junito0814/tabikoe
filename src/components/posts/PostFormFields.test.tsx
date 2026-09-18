/**
 * 出典: docs/tasks/posts/post-creation-v3/02-form-layout-compaction.md（単体テスト）
 * 「カテゴリ・滞在時間が <select> で 7／5 個の選択肢を持つこと」「注意文が畳まれ、「詳しく」で全文が出ること」
 * 「既存の必須検証（旅行タイトル・スポット・星・写真）が変わらず動くこと」
 */
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_POST_FORM_VALUES, hasAnyPostInput, isPostFormComplete, PostFormFields } from "./PostFormFields";

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
  it("カテゴリは 7 つ、滞在時間は 5 つのドロップダウン", () => {
    renderFields();
    const category = screen.getByLabelText("カテゴリ *") as HTMLSelectElement;
    expect(category.options.length - 1).toBe(7);
    const duration = screen.getByLabelText("滞在時間 *") as HTMLSelectElement;
    expect(duration.options.length - 1).toBe(5);
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
});

describe("hasAnyPostInput", () => {
  it("何も無ければ false、1 つでもあれば true", () => {
    expect(hasAnyPostInput(EMPTY_POST_FORM_VALUES, 0)).toBe(false);
    expect(hasAnyPostInput({ ...EMPTY_POST_FORM_VALUES, comment: "a" }, 0)).toBe(true);
    expect(hasAnyPostInput(EMPTY_POST_FORM_VALUES, 1)).toBe(true);
  });
});
