-- F-AC-04 Task4: アイコン画像用Storageバケットの作成
-- 出典: docs/tasks/account/profile-edit/04-avatar-upload-handler.md
--
-- アップロード自体はRoute Handlers（Service Role Key）が行うためRLSを回避するが、
-- 表示（<img>タグからの読み込み）は誰でも可能である必要があるためbucketをpublicにする。
-- 以下のポリシーは、将来ブラウザから直接Storageへアップロードする経路を追加する場合に備えるもの。

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select_all"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
