import { backLabelFor, classifyBackHref } from "@/lib/map/back-label";
/**
 * post-timeline Task3: 一覧のスクロール位置・読み込み済みページ数の保存と復元
 * 出典: docs/tasks/map-search/post-timeline/03-scroll-and-back.md
 *       要件定義書 v3.0 3.4.2（「一覧に戻る」で位置・条件を保って戻る。受入条件 46）
 *
 * 【初心者向け】検索条件・絞り込み・並び替えは URL クエリに持つ（URL がそのまま「条件」になる）。
 * URL に持てない「どこまでスクロールしたか」「何ページ読み込んだか」は sessionStorage に保存する。
 *   - キーは URL（パス＋クエリ）。同じ条件で戻ってきたときだけ復元される
 *   - sessionStorage はタブを閉じると消える（永続化しない。localStorage ではない）
 *   - 読み込み済みページ数を覚えておくと、戻ったときに同じ件数まで取り直せる（スクロール位置が意味を持つ）
 * ブラウザ以外（テスト・SSR）や Safari のプライベートモードでは storage が例外を投げるので、すべて try/catch で包む。
 */
export interface ListState {
  /** window.scrollY */
  scrollY: number;
  /** 読み込み済みのページ数（1 始まり） */
  loadedPages: number;
}

const KEY_PREFIX = "tabikoe:list-state:";
/** 保存から 30 分を過ぎたものは使わない（古い一覧に戻る意味が薄い） */
const MAX_AGE_MS = 30 * 60 * 1000;

interface StoredListState extends ListState {
  savedAt: number;
}

/** 現在の URL（パス＋クエリ）をキーにする。ハッシュは含めない */
export function listStateKey(url: string): string {
  return `${KEY_PREFIX}${url.split("#")[0]}`;
}

export function saveListState(url: string, state: ListState, storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    const stored: StoredListState = { ...state, savedAt: Date.now() };
    storage.setItem(listStateKey(url), JSON.stringify(stored));
  } catch {
    // 容量超過やプライベートモードでは黙って諦める
  }
}

export function loadListState(url: string, storage: Storage | undefined = defaultStorage(), now: number = Date.now()): ListState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(listStateKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredListState>;
    if (typeof parsed.scrollY !== "number" || typeof parsed.loadedPages !== "number" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > MAX_AGE_MS) return null;
    return { scrollY: parsed.scrollY, loadedPages: Math.max(1, Math.floor(parsed.loadedPages)) };
  } catch {
    return null;
  }
}

export function clearListState(url: string, storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(listStateKey(url));
  } catch {
    // noop
  }
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * 地図の「一覧に戻る」用: 一覧の URL を `back` に埋め込んだ地図 URL を作る。
 * 例: /map?spot=<id>&lat=..&lng=..&back=%2Fsearch%3Fpref%3D...
 */
export function buildMapHrefWithBack(mapParams: Record<string, string | number | null | undefined>, backUrl: string | null): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(mapParams)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  if (backUrl) params.set("back", backUrl);
  const query = params.toString();
  return `/map${query ? `?${query}` : ""}`;
}

/**
 * Bug #469: 一覧・詳細のリンクに「どこから来たか」を `back=` で付ける（無ければそのまま）。
 * 例: appendBackHref("/search?spot=s1", "/search?pref=東京都") → /search?spot=s1&back=%2Fsearch%3Fpref%3D...
 * 【初心者向け】戻るボタンは「直前の画面」に戻したい。ブラウザの履歴には頼れない（URL を直接開くこともある）ので、
 * リンクの URL に戻り先を持たせて次の画面に渡す。次の画面はさらにその URL を自分の戻り先として渡す（数珠つなぎ）。
 */
export function appendBackHref(href: string, back: string | null | undefined): string {
  if (!back) return href;
  const url = new URL(href, "https://tabikoe.local");
  url.searchParams.set("back", back);
  return `${url.pathname}${url.search}`;
}

/** `back` クエリの安全な読み取り。同一サイトの相対パス（/search…）だけ許す（オープンリダイレクト対策） */
export function parseBackHref(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Bug #469: `?back=` から一覧画面の戻り先（URL と画面名）を決める。無ければ null（呼び出し側が既定の戻り先を使う）。
 * 画面名は地図（SC-02）と同じ規則（lib/map/back-label.ts）: /search?pref=東京都 → 東京都、/search?q=東京駅 → 東京駅、/ → ホーム
 */
export function resolveListBack(value: string | null | undefined): { href: string; label: string } | null {
  const href = parseBackHref(value);
  if (!href) return null;
  return { href, label: backLabelFor(classifyBackHref(href)) };
}
