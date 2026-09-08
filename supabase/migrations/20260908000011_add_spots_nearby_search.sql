-- F-PO-01 スポット指定 Task1: spots テーブルの近傍検索インデックス整備
-- 出典: docs/tasks/posts/spot-selection/01-spots-geo-search-index.md
--
-- タスク仕様は「PostGISのgeographyインデックス、または簡易的な範囲検索＋Haversine計算の
-- いずれか」を認めている。PostGIS拡張の有効化という追加依存を避けるため後者を採用する。
-- 判定対象は半径50m・候補は最大5件程度の規模のため、矩形で絞ってからHaversineで
-- 正確に距離を出す方式で十分。
--
-- 重複登録防止（Task5）と候補検索（Task2）の双方から利用する。

create index if not exists spots_lat_lng_idx on public.spots (lat, lng);

create or replace function public.find_nearby_spots(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  prefecture text,
  source text,
  distance_meters double precision
)
language sql
stable
as $$
  -- 緯度1度は約111,320m。経度1度の距離はcos(緯度)倍に縮むため、
  -- 極付近で0除算にならないようgreatestで下限を設ける。
  select *
  from (
    select
      s.id,
      s.name,
      s.lat,
      s.lng,
      s.prefecture,
      s.source,
      6371000.0 * 2 * asin(sqrt(
        power(sin(radians(s.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(s.lat))
        * power(sin(radians(s.lng - p_lng) / 2), 2)
      )) as distance_meters
    from public.spots s
    where s.lat between p_lat - (p_radius_meters / 111320.0)
                    and p_lat + (p_radius_meters / 111320.0)
      and s.lng between p_lng - (p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.000001)))
                    and p_lng + (p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.000001)))
  ) candidates
  where candidates.distance_meters <= p_radius_meters
  order by candidates.distance_meters
$$;

-- security invoker（既定）のためRLSがそのまま効く。
-- spots_select_allにより認証済みユーザーは閲覧可能なので、実行権限を絞る必要はない。
