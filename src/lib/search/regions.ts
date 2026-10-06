import { PREFECTURES } from "@/lib/geo/prefectures";

/**
 * #809: 地方（北海道・東北／関東／…）と都道府県の対応
 * 出典: 要件定義書 3.4.2「絞り込みのエリア」、ワイヤーフレーム決定事項 83
 *
 * 【初心者向け】「みんなの投稿」は行き先を決めずに開くので、絞り込みで地域を選べるようにする。
 * 1 つずつ 47 個から選ぶのは大変なので、**地方のチェックでまとめて選べる**ようにした。
 *
 * ここは**判断だけを集めた純粋関数の置き場**（約束 13）。画面は結果を並べるだけ。
 *   - `REGIONS`      … 地方 → 都道府県（並びは北から南）
 *   - `regionState`  … その地方が「全部／一部／選んでいない」のどれか
 *   - `toggleRegion` … 地方のチェックを押したときの次の選択
 *   - `areaChips`    … 絞ったあとに出す札。**全部選んだ地方は 1 枚にまとめる**
 *
 * 海外に出すときは、この表に「海外」の地方を足すだけで画面が増える（要件 3.4.2）。
 */
export interface Region {
  name: string;
  prefectures: readonly string[];
}

export const REGIONS: readonly Region[] = [
  { name: "北海道・東北", prefectures: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { name: "関東", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { name: "中部", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { name: "近畿", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { name: "中国", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { name: "四国", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { name: "九州・沖縄", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];

/** 47 都道府県がすべてどれかの地方に入っているか（取りこぼし防止。単体テストが見る） */
export function allRegionPrefectures(): string[] {
  return REGIONS.flatMap((region) => [...region.prefectures]);
}

/** 知らない名前を落とし、北から南の順にそろえる（URL から来た値をそのまま信じない） */
export function normalizeAreas(names: readonly string[]): string[] {
  const known = new Set(allRegionPrefectures());
  const picked = new Set(names.filter((name) => known.has(name)));
  return allRegionPrefectures().filter((name) => picked.has(name));
}

export type RegionState = "all" | "some" | "none";

/** その地方が「全部／一部／選んでいない」のどれか（□ の形を決める） */
export function regionState(region: Region, selected: readonly string[]): RegionState {
  const picked = new Set(selected);
  const count = region.prefectures.filter((name) => picked.has(name)).length;
  if (count === 0) return "none";
  return count === region.prefectures.length ? "all" : "some";
}

/**
 * 地方の □ を押したときの次の選択。
 * 全部入っていれば**その地方を全部外す**、それ以外（一部・未選択）は**全部入れる**。
 * 「一部 → 全部」にするのは、一部だけ選んでいる人が押す意図は「残りも入れたい」だから。
 */
export function toggleRegion(region: Region, selected: readonly string[]): string[] {
  const state = regionState(region, selected);
  const picked = new Set(selected);
  for (const name of region.prefectures) {
    if (state === "all") picked.delete(name);
    else picked.add(name);
  }
  return normalizeAreas([...picked]);
}

/** 都道府県 1 つの出し入れ */
export function togglePrefecture(name: string, selected: readonly string[]): string[] {
  const picked = new Set(selected);
  if (picked.has(name)) picked.delete(name);
  else picked.add(name);
  return normalizeAreas([...picked]);
}

export interface AreaChip {
  /** 札に出す文字 */
  label: string;
  /** × を押したときに外す都道府県 */
  prefectures: string[];
}

/**
 * 絞ったあとに出す札。
 * **全部選んだ地方は「関東」の 1 枚にまとめる**（都道府県ごとに出すと、2 地方で 14 枚になり
 * 一覧が下に押し出されるため。2026-10-06 の決定）。一部だけの地方は都道府県ごとに出す。
 */
export function areaChips(selected: readonly string[]): AreaChip[] {
  const picked = new Set(normalizeAreas(selected));
  const chips: AreaChip[] = [];
  for (const region of REGIONS) {
    const state = regionState(region, [...picked]);
    if (state === "none") continue;
    if (state === "all") {
      chips.push({ label: region.name, prefectures: [...region.prefectures] });
      continue;
    }
    for (const name of region.prefectures) {
      if (picked.has(name)) chips.push({ label: name, prefectures: [name] });
    }
  }
  return chips;
}

/** 札の × を押したとき（その塊ごと外す） */
export function removeAreaChip(chip: AreaChip, selected: readonly string[]): string[] {
  const picked = new Set(selected);
  for (const name of chip.prefectures) picked.delete(name);
  return normalizeAreas([...picked]);
}

/** 都道府県の固定リストに無い名前が REGIONS に混ざっていないか（単体テストが見る） */
export function unknownRegionNames(): string[] {
  const known = new Set(PREFECTURES.map((p) => p.name));
  return allRegionPrefectures().filter((name) => !known.has(name));
}
