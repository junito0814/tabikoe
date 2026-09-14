-- F-VW-01 Task1: 非公開投稿をアルバムメンバーにも見せる（RLS の二重防御）
-- 出典: docs/tasks/browsing/post-detail-view/01-post-detail-handler.md
--       要件定義書3.3.6（アルバム共有時）・3.6.3（アルバム内での公開設定の扱い）・7.2
--
-- 20260908000001 の posts_select_visible は「公開 or 本人」だけだった。
-- 投稿が属する旅行（trip）のアルバムメンバー（owner/editor/viewer）は、公開設定にかかわらず
-- その投稿を閲覧できる（3.6.3）。Route Handler（GET /api/posts/[id]）で同じ判定を行うが、
-- PostgREST 直接アクセスでも同じ結果になるようポリシー側にも同じ条件を持たせる。
-- post_photos・comments の閲覧ポリシーも同じ判定に揃える。

create or replace function public.can_view_post(p_trip_id uuid, p_owner_id uuid, p_visibility text)
returns boolean
language sql
stable
as $$
  select p_visibility = 'public'
      or p_owner_id = auth.uid()
      or exists (
        select 1 from public.album_members m
        where m.trip_id = p_trip_id and m.user_id = auth.uid()
      )
$$;

-- security invoker（既定）。album_members の RLS は自分の行しか見せないため、
-- 「自分がメンバーか」の判定にはそれで十分。

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (public.can_view_post(trip_id, user_id, visibility));

drop policy if exists "post_photos_select_visible" on public.post_photos;
create policy "post_photos_select_visible"
  on public.post_photos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_photos.post_id
        and public.can_view_post(p.trip_id, p.user_id, p.visibility)
    )
  );

drop policy if exists "comments_select_visible_post" on public.comments;
create policy "comments_select_visible_post"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and public.can_view_post(p.trip_id, p.user_id, p.visibility)
    )
  );

-- コメント・いいねは公開投稿にしか付かない（3.3.6）。書き込みポリシーにも条件を足しておく
drop policy if exists "comments_owner_write" on public.comments;
create policy "comments_owner_write"
  on public.comments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = comments.post_id and p.visibility = 'public')
  );

drop policy if exists "likes_owner_all" on public.likes;
create policy "likes_owner_all"
  on public.likes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = likes.post_id and p.visibility = 'public')
  );

-- 一覧・件数取得で使う索引
create index if not exists comments_post_created_idx on public.comments (post_id, created_at desc);
create index if not exists likes_post_idx on public.likes (post_id);
