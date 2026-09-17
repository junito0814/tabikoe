-- table-catalog-v3 Task3（続き）: 退会処理にしおりのオーナー継承を組み込む
-- 出典: docs/tasks/data-model/table-catalog-v3/03-itinerary-members-invitations.md
--       要件定義書 v3.0 3.11.7（オーナーの退会）
--
-- 【初心者向け】deactivate_user() は退会のすべて（アルバムのオーナー継承・いいね等の削除・匿名化）を
-- 1 つのトランザクションで行う関数。ここでは中身を書き直さず、先頭で
-- transfer_itinerary_ownership()（20260917000002）を呼ぶ「ラッパー」に置き換える方が安全なので、
-- 既存の関数を deactivate_user_v1 として残し、新しい deactivate_user がそれを呼ぶ形にする。

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'deactivate_user_v1') then
    alter function public.deactivate_user(uuid) rename to deactivate_user_v1;
  end if;
end $$;

create or replace function public.deactivate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- しおりのオーナーを先に移す（旅行のオーナー継承より前でも後でも結果は同じだが、
  -- しおりが削除される場合に notifications を残さないため先に行う）
  perform public.transfer_itinerary_ownership(p_user_id);
  perform public.deactivate_user_v1(p_user_id);
end;
$$;

revoke all on function public.deactivate_user(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_user(uuid) to service_role;
revoke all on function public.deactivate_user_v1(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_user_v1(uuid) to service_role;
