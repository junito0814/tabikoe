"use client";

/**
 * 同意のチェック 1 つ分（利用規約／個人情報保護方針）。
 * 【初心者向け】実際の checkbox を視覚的に隠して置き（sr-only）、見た目は隣の span で描く。
 * こうするとキーボード（Tab → Space）とスクリーンリーダーでも操作できる（要件定義書 7.7）。
 */
export function ConsentCheckbox({
    checked,
    onChange,
    label,
    href,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    /** legal-documents Task 1: 本文を読むページ（/terms・/privacy）。新しいタブで開く */
    href?: string;
}) {
    return (
        <label className="flex w-full cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                aria-label={`${label}に同意する`}
                className="peer sr-only"
            />
            <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${checked ? "bg-accent border-accent" : "border-line bg-transparent"}`}
            >
                {checked && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            <span className="select-none text-[0.8125rem] leading-[1.65] text-ink">
                {href ? (
                    // 本文を読みに行ってもチェック欄の状態が消えないよう、新しいタブで開く
                    <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="font-medium text-accent underline underline-offset-2">
                        {label}
                    </a>
                ) : (
                    <span className="font-medium text-accent">{label}</span>
                )}
                {" に同意する"}
            </span>
        </label>
    );
}
