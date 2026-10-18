# Task 1: 47 県の絵の対応表（データと純粋関数）

> 出典: [status-badges.md](../../../user-stories/badges/status-badges.md)
> インデックス: [prefecture-motifs](00-index.md)
> 要件定義書 4.5.20（47 県の表・描き方の決まり）、8 章 102

## 依存

なし

## 背景

47 都道府県のバッジが**すべて同じ 🏅** だった。画面では 3 列で 47 個が並ぶのに、**全部同じ絵**なので、どれがどの県か見分けが付かない。

絵は 2026-10-17 に**画面で実寸を見ながら** 47 県ぶん決めた（要件 4.5.20）。このタスクは**決まった絵をデータとして置き、県名から引けるようにする**だけで、画面には何も出さない。

## 実装内容

### 1-1. `src/lib/badges/prefecture-motifs.ts`（新規）

[motifs.json](motifs.json) の中身を TypeScript に写す。形は次のとおり。

```ts
/** 絵の 1 層。線だけの層・塗りだけの層・両方の層がある */
export interface MotifLayer {
  /** SVG の path。viewBox は 0 0 100 100、中心 (50,50) */
  d: string;
  /** 塗りの色。実際には 22% に薄めて使う（下の fillOf を通す） */
  fill?: string;
  stroke?: string;
  /** 線の太さ。既定は 7 */
  w?: number;
}

export interface PrefectureMotif {
  /** その県の主色 */
  hue: string;
  layers: readonly MotifLayer[];
}

const MOTIFS: Readonly<Record<string, PrefectureMotif>> = { /* 47 県 */ };

/** 県名から絵を引く。**無い県は null**（呼ぶ側が 🏅 に落とす。要件 8 章 102） */
export function prefectureMotif(prefecture: string): PrefectureMotif | null;

/** 塗りの色。その色を 22% だけ使い、残りは透明にして背景と混ぜる */
export function motifFill(color: string): string;
```

**`prefectureMotif` が null を返せることが、このタスクのいちばん大事なところ。** 47 県が揃う前でも画面が壊れないようにするための作りで、埼玉や富士山をあとで差し替えるときもここで済む。

### 1-2. 絵のデータの決まり（要件 4.5.20 の再掲。コードのコメントにも書く）

- **viewBox は `0 0 100 100`**、中心 (50,50)、だいたい 10〜90 の範囲に収める
- **線幅は既定 7、両端と角は丸**（`stroke-linecap="round" stroke-linejoin="round"`）
- **線の本数は 20 本まで**（18〜20 本が 48px での境目だった）
- **文字（`<text>`）は 1 つも使わない**（規則 4）
- **色は 17 色**。中くらいの明るさだけを使い、ライトでもダークでも見えるようにする

### 1-3. 置き場所について

**`catalog.ts` には入れない。** `catalog.ts` は「バッジの種別と獲得条件」を持つファイルで、**サーバー側（`award-badges.ts`）からも読む**。絵のデータ（約 20KB）を混ぜると、サーバーの束にも絵が入る。別ファイルにして**画面からだけ読む**。

## 成果物

| ファイル | 中身 |
|---|---|
| `src/lib/badges/prefecture-motifs.ts` | 47 県の絵のデータ、`prefectureMotif`、`motifFill` |
| `src/lib/badges/prefecture-motifs.test.ts` | 下記のテスト |

## テスト要件

### 単体（Vitest）

- **47 県すべてに絵があること** ── `PREFECTURES`（`catalog.ts`）を回して `prefectureMotif` が null を返さないこと。**県名は `catalog.ts` の `PREFECTURES` と完全に一致すること**（表記が 1 文字違うと 🏅 に落ちるのに気づけない）
- **同じ絵が 2 県に無いこと** ── 層をつないだ文字列で照合する
- **絵の中に文字が無いこと** ── どの層の `d` にも `<text>` が入らないこと（path しか持たないので構造上入らないが、規則 4 を明文化して守る）
- **線の本数が 20 本以下であること** ── 層の `d` に含まれる `M` の数を数える
- **座標が範囲内であること** ── 数値が NaN でなく、**95 を超えないこと**（はみ出すと枠からあふれる）
- **`prefectureMotif` が、知らない県名（"東京"・""・"Tokyo"）で null を返すこと**
- **`motifFill` が `color-mix` の式を返すこと**

### 結合・E2E

なし（画面に出ないため。Task 2 で見る）

## 関連する受入条件

- [ ] 「県名 → 絵」の対応表に絵が無い県は 🏅 のまま出ること（要件 8 章 102。このタスクでは `null` を返すところまで）
