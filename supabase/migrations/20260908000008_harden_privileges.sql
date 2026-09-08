-- セキュリティ修正: SECURITY DEFINER関数の実行権限と、usersテーブルの列単位更新権限を絞る
--
-- 背景（このマイグレーション以前の状態で実際に悪用可能だったもの）:
--
-- 1. PostgreSQLは新規作成した関数に既定でPUBLICへEXECUTEを付与し、Supabaseは
--    publicスキーマの関数をPostgRESTのRPCエンドポイントとして公開する。
--    そのためbrowserに配布されるpublishable(anon)キーだけで
--    POST /rest/v1/rpc/deactivate_user に任意のユーザーIDを渡せてしまい、
--    SECURITY DEFINERでRLSを回避したまま他人のアカウントを匿名化・データ削除できた。
--    check_rate_limitも同様に、任意のsubject（他人のIPアドレス）のカウンタを
--    外部から加算してログイン不能にできた。
--    → 両関数ともRoute Handlers（Service Role Key）専用のため、service_roleのみに絞る。
--
-- 2. usersのRLSポリシー users_update_own は行単位の制御しかしておらず、
--    列単位のGRANTも既定のまま（authenticatedに全列UPDATE可）だった。
--    そのため認証済みユーザーが PATCH /rest/v1/users?id=eq.<自分のid> に
--    {"is_admin": true} を送るだけで管理者に昇格でき、
--    src/proxy.ts の /admin ガードを無効化できた。
--    → RLSでは列を制限できないため、列単位のGRANTで更新可能な列を限定する。

revoke all on function public.deactivate_user(uuid) from public;
revoke all on function public.deactivate_user(uuid) from anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, text, integer, integer) from anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

-- is_admin / is_deleted / email / idp_provider / idp_subject / consented_at / created_at は
-- 本人からは更新させない（管理者権限の自己付与・同意日時の改ざん等を防ぐ）。
-- これらの更新はすべてRoute Handlers（Service Role Key）経由で行う。
revoke update on public.users from anon, authenticated;
grant update (display_name, avatar_url) on public.users to authenticated;
