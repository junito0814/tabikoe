-- 修正: テーブル権限（GRANT）が付与されておらず、全テーブルが利用できなかった問題
--
-- これまでのマイグレーションは、Supabaseが`public`スキーマの新規テーブルに対して
-- anon/authenticated/service_roleへ自動でGRANTすることを暗黙の前提にしていた。
-- 実際のプロジェクトではその既定権限が効いておらず、Service Role Keyでのアクセスすら
-- 「permission denied for table users」（42501）で失敗していた。
-- マイグレーションはプロジェクト側の既定に依存せず、必要な権限を明示的に付与する。
--
-- 方針（要件定義書5.3）:
--   - service_role : Route Handlersからの全アクセス経路。全テーブルに全権限
--   - authenticated: RLSを二重の防御線として機能させるため、ユーザースコープの
--                    クライアントで実際に触る操作のみ許可する
--   - anon         : 全機能がログイン必須（3.5.4）のため付与しない

-- service_role: Route Handlers（RLS回避）用
grant all privileges on table
  public.users,
  public.trips,
  public.spots,
  public.posts,
  public.post_photos,
  public.album_members,
  public.notifications,
  public.comments,
  public.likes,
  public.wishlist,
  public.blocks,
  public.rate_limits
to service_role;

-- authenticated: 更新可能な列は20260908000008で絞ってあるため、ここではSELECTのみ付与する
-- （is_admin等を本人が書き換えられる状態に戻さないこと）
grant select on table public.users to authenticated;
grant update (display_name, avatar_url) on table public.users to authenticated;

-- 自分のデータをRLSの範囲内で読み書きするテーブル
grant select, insert, update, delete on table
  public.trips,
  public.posts,
  public.post_photos,
  public.comments,
  public.likes,
  public.wishlist,
  public.blocks
to authenticated;

-- 参照のみ許可。書き込みはRoute Handlers（service_role）経由で行う
--   spots         : 全ユーザー共有のマスタ
--   album_members : 権限変更はF-RC-03のアルバム機能で扱う
--   notifications : 発生元の各機能がservice_roleでINSERTする
grant select on table
  public.spots,
  public.album_members,
  public.notifications
to authenticated;

-- rate_limitsはRoute Handlers専用のため、authenticatedには一切付与しない
