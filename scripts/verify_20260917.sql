-- table-catalog-v3 Task5: v3.0 マイグレーション（20260917000001〜4）の適用確認
-- Supabase の SQL エディタで実行する。各行が true / 期待どおりの値になればよい。

-- 1. posts の新列と制約
select
  exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'status') as posts_status,
  exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'lat') as posts_lat,
  exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'published_at') as posts_published_at,
  exists (select 1 from pg_constraint where conname = 'posts_published_required_check') as posts_published_required_check,
  (select count(*) from public.posts where category = 'イベント会場') as legacy_category_rows_should_be_0;

-- 2. しおり系テーブルと RLS
select table_name, row_security_active(('public.' || table_name)::regclass) as rls
from information_schema.tables
where table_schema = 'public'
  and table_name in ('itineraries', 'itinerary_spots', 'itinerary_members', 'itinerary_invitations', 'spot_status_reports')
order by table_name;

-- 3. 関数と権限（authenticated から実行できないこと）
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute_should_be_false,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute_should_be_true
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('accept_itinerary_invitation', 'transfer_itinerary_ownership', 'deactivate_user', 'ensure_itinerary_owner_membership');

-- 4. ビュー
select exists (select 1 from information_schema.views where table_name = 'spot_latest_status') as spot_latest_status_view;
