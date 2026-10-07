-- #754 の直し: announcement_reads に権限を渡し忘れていた
--
-- 【初心者向け】何が起きたか。
--   20261007000001 で表は出来たのに、**誰も読み書きできませんでした**
--   （`permission denied for table announcement_reads`）。
--
--   ふつうの Supabase なら、新しく作った表には既定で権限が付きます。
--   ところがこのプロジェクトは 20260908000008（harden_privileges）と 20260908000012 で
--   **その既定を外しています**（匿名の鍵だけで他人のアカウントを消せた・自分を管理者にできた、
--   という実際の穴をふさぐため）。その代わりに、**表を 1 つ作るたびに書く**約束になっています。
--   私はそれを書き忘れました。strikes（20260927000002 の 46-47 行）が見本です。
--
-- 誰に何を渡すか
--   - service_role … 全部。既読を付ける／外すのは Route Handler（サーバー側）だけが行う
--   - authenticated … select だけ。未読の数を数えるのに、利用者の鍵で件数を引くため
--     （何件読んだかを数えるだけ。RLS で自分の行しか見えない）
--   書き込みは利用者の鍵では行わないので、insert / delete は渡しません。

grant all privileges on table public.announcement_reads to service_role;
grant select on table public.announcement_reads to authenticated;

-- 書き込みの権限を渡さないので、insert / delete の RLS は働きようがありません。
-- 「ポリシーがあるのに書けない」は読む人を迷わせるので外します
-- （書き込みは service_role が行い、service_role は RLS を通りません）。
drop policy if exists announcement_reads_insert_own on public.announcement_reads;
drop policy if exists announcement_reads_delete_own on public.announcement_reads;
