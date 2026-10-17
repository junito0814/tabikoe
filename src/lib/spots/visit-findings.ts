/**
 * #929: 「行ってわかったこと」の項目
 * 出典: Issue #929、要件定義書 4.5.19、ワイヤーフレーム決定事項 99
 *
 * 【初心者向け】**行った人にしか分からず、調べても出てこないこと**だけを集めます。
 * Wi-Fi（店の公式サイトに出ている）・喫煙（店頭表示の義務）・駅から近い（地図で分かる）は入れません。
 *
 * **項目はここだけに書きます。** 画面（投稿・スポット・絞り込み）はこの一覧から作るので、
 * 1 つ足すときに触るのもここだけです（要件 4.5.19 の受入条件）。
 *
 * **グループの見出しが動詞を持っている**ので、項目は単語で済みます。
 * 「入れた ＞ 車椅子」は「車椅子で入れた」以外に読みようがありません。
 * ~~「車椅子で入れた」と全部を文にする~~ → 似た言葉が並んで読みにくく、画面も縦に伸びるため採りませんでした。
 */
export const VISIT_FINDING_GROUPS = [
  { key: "entered", label: "入れた", findings: ["pet", "stroller", "wheelchair", "suitcase", "no_reservation"] },
  { key: "available", label: "あった", findings: ["parking", "elevator"] },
  { key: "fine", label: "平気だった", findings: ["with_kids", "large_group"] },
  { key: "payment", label: "支払い", findings: ["card", "emoney"] },
] as const satisfies readonly { key: string; label: string; findings: readonly string[] }[];

export type VisitFindingGroupKey = (typeof VISIT_FINDING_GROUPS)[number]["key"];
export type VisitFinding = (typeof VISIT_FINDING_GROUPS)[number]["findings"][number];

/** 画面に出す言葉。**入力も表示も絞り込みも、この同じ単語を使う**（言い換えの対応表を持たない） */
export const VISIT_FINDING_LABELS: Record<VisitFinding, string> = {
  pet: "ペット",
  stroller: "ベビーカー",
  wheelchair: "車椅子",
  suitcase: "スーツケース",
  no_reservation: "予約なし",
  parking: "駐車場",
  elevator: "エレベーター",
  with_kids: "子連れ",
  large_group: "大人数",
  card: "カード",
  emoney: "電子マネー・QR",
};

/** 一覧（並びはグループの順）。DB には CHECK を置かないので、受け取った値はここで確かめる */
export const VISIT_FINDINGS: readonly VisitFinding[] = VISIT_FINDING_GROUPS.flatMap((group) => [...group.findings]);

export function isVisitFinding(value: unknown): value is VisitFinding {
  return typeof value === "string" && (VISIT_FINDINGS as readonly string[]).includes(value);
}

/**
 * 受け取った並びを、**知っている項目だけ・重複なし・決まった順**に整える（純粋関数）。
 *
 * 【初心者向け】ブラウザから来た値をそのまま信じないためです。順を揃えておくと、
 * 保存したものと画面に出すものが毎回同じ並びになり、見比べやすくなります。
 */
export function normalizeVisitFindings(values: readonly unknown[]): VisitFinding[] {
  const chosen = new Set(values.filter(isVisitFinding));
  return VISIT_FINDINGS.filter((finding) => chosen.has(finding));
}

/**
 * #929-c: 絞り込みの判定（純粋関数）。選んだ項目が**すべて**そろっているスポットの id を返す。
 *
 * 【初心者向け】カテゴリは「どれか 1 つ」（OR）ですが、こちらは **AND** です。
 * 投稿のカテゴリは 1 件に 1 つしか無いので OR にするしかありませんが、
 * スポットは報告を**複数持てる**ので意味が変わります。犬を連れていて車でも行く人は、
 * ペットと駐車場の**両方**そろっていないと意味がありません（要件 4.5.19）。
 * Airbnb のアメニティ、食べログのこだわり条件も AND です。
 *
 * 報告が 1 つも無いスポットは、条件を 1 つでも選んだ時点で落ちます
 * （費用で絞ると未入力の投稿が出ないのと同じ考え方）。
 *
 * **ここが「どのスポットが残るか」を決める唯一の場所**です。検索結果（search-spots.ts）と
 * 地図の探すモード（spot-aggregate.ts）はどちらもこの答えを使うので、食い違いません（約束 14）。
 */
export function spotIdsWithAllFindings(
  rows: readonly { spotId: string; finding: string }[],
  required: readonly VisitFinding[]
): Set<string> {
  const bySpot = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!isVisitFinding(row.finding)) continue;
    const current = bySpot.get(row.spotId);
    if (current) current.add(row.finding);
    else bySpot.set(row.spotId, new Set([row.finding]));
  }
  const matched = new Set<string>();
  for (const [spotId, findings] of bySpot) {
    if (required.every((finding) => findings.has(finding))) matched.add(spotId);
  }
  return matched;
}
