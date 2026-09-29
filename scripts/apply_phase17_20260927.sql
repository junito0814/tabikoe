-- Phase 17（管理画面の作り直し）のマイグレーションをまとめて当てる（Supabase の SQL エディタに貼る）。上から順に実行される。
-- 追加した順: 20260927000001_admin_actions → 20260927000002_strikes → 20260927000003_spots_created_at → 20260927000004_last_active_at → 20260927000005_admin_notifications → 20260927000006_user_management → 20260927000007_moderation_action → 20260927000008_auto_hide → 20260927000009_spot_fix_request → 20260927000010_legal_documents

-- user-management Task 4: 操作の記録（admin_actions）
-- 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
--       要件定義書 3.10.12「操作の記録」（管理者の操作と自動処理を残す。消せない）
--
-- 【初心者向け】operation_logs（要件 7.5）は「利用者の操作」の監査ログで 90 日で消す前提。
-- こちらは「管理者が誰に何をしたか」「自動処理が何をしたか」を人が読める形で残す台帳で、
-- 後から説明できるように **UPDATE・DELETE をどの役割にも許さない**（INSERT と SELECT だけ）。
-- GRANT で塞いだうえで、テーブルの所有者（postgres）が触っても止まるようトリガーでも拒否する。
-- actor_id が NULL の行は「自動」（自動非公開・仮停止など）。

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  -- 誰が。NULL は自動処理。退会で users が消えても記録は残す（set null）
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  -- 何に。target_type は 'post' | 'comment' | 'spot' | 'trip' | 'user' | 'report' | 'announcement' | 'legal_document' など
  target_type text,
  target_id uuid,
  -- 一覧に出す言い方（例: 投稿「たこ焼き〇〇の感想」（はなこ））。対象が消えても読めるように文字で持つ
  target_label text,
  -- 理由（管理者のメモ。自動処理は判定の内容）
  note text,
  created_at timestamptz not null default now(),
  constraint admin_actions_action_check check (
    action in (
      'report_hide',
      'report_delete',
      'report_no_issue',
      'auto_hide',
      'strike_add',
      'strike_revoke',
      'user_suspend',
      'user_provisional_suspend',
      'user_confirm_suspension',
      'user_unsuspend',
      'hidden_restore',
      'spot_fix_request',
      'announcement_create',
      'announcement_update',
      'announcement_delete',
      'legal_publish'
    )
  )
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_actor_id_idx on public.admin_actions (actor_id);
create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;

-- 閲覧は管理者だけ（operation_logs と同じ判定）
drop policy if exists "admin_actions_select_admin" on public.admin_actions;
create policy "admin_actions_select_admin"
  on public.admin_actions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 書き込みは Route Handler が service_role で行う。UPDATE・DELETE・TRUNCATE は誰にも許さない
revoke all privileges on table public.admin_actions from anon, authenticated, service_role;
grant select on table public.admin_actions to authenticated;
grant select, insert on table public.admin_actions to service_role;

-- 所有者が直接 SQL を打っても消せないように、トリガーでも拒否する
create or replace function public.admin_actions_reject_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_actions は書き換え・削除できません（要件定義書 3.10.12）';
end;
$$;

drop trigger if exists admin_actions_no_update on public.admin_actions;
create trigger admin_actions_no_update
  before update or delete on public.admin_actions
  for each row execute function public.admin_actions_reject_change();

-- 追加した順（続き）: 20260927000002_strikes

-- strike-system Task 1: ストライクのデータ
-- 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md
--       要件定義書 3.10.7「ストライク制」・3.10.8「自動で行う対応」
--
-- 【初心者向け】ストライク＝「管理者が非公開化・削除を確定した」という違反の記録。通報の件数では付かない。
--   1. strikes … 1 行が 1 ストライク。90 日で失効（expires_at）、管理者が取り消せる（revoked_at）
--   2. users.posting_restricted_until … 投稿・コメント禁止の解除日時（有効 2 で 3 日、3 で 7 日、4 で 30 日）
--      users.suspension_kind … 停止の種類。'provisional'（自動の仮停止）／'confirmed'（管理者が確定・手動停止）
--      停止そのものは既存の suspended_at で表す（proxy.ts の判定はそのまま）
--   3. moderation_settings … しきい値。コードに直書きせず、ここを読む（値を変えるときにデプロイが要らない）

-- 1. strikes
create table if not exists public.strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- どの通報の対応で付いたか（通報が消えても記録は残す）
  report_id uuid references public.reports (id) on delete set null,
  -- 通報の理由（reports.reason と同じ値）
  reason text not null,
  -- 何をしたか（'hide' | 'delete'）
  action text not null,
  -- 対象の言い方（例: 感想「…」）。対象が消えても本人に説明できるように文字で持つ
  target_label text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.users (id) on delete set null,
  revoke_note text,
  constraint strikes_action_check check (action in ('hide', 'delete'))
);

create index if not exists strikes_user_created_idx on public.strikes (user_id, created_at desc);

alter table public.strikes enable row level security;

-- 本人は自分の分を読める（SC-28 アカウントの状態）。管理者は全員分
drop policy if exists "strikes_select_own_or_admin" on public.strikes;
create policy "strikes_select_own_or_admin"
  on public.strikes
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user());

-- 書き込みは Route Handler が service_role で行う（本人が消せてはいけない）
grant all privileges on table public.strikes to service_role;
grant select on table public.strikes to authenticated;

-- 2. users の列
alter table public.users add column if not exists posting_restricted_until timestamptz;
alter table public.users add column if not exists suspension_kind text;
alter table public.users drop constraint if exists users_suspension_kind_check;
alter table public.users add constraint users_suspension_kind_check
  check (suspension_kind is null or suspension_kind in ('provisional', 'confirmed'));
-- 本人の UPDATE は display_name・avatar_url に限っている（20260908000008）ので、この 2 列は自動的に守られる

-- 3. しきい値
create table if not exists public.moderation_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.moderation_settings enable row level security;

drop policy if exists "moderation_settings_select_admin" on public.moderation_settings;
create policy "moderation_settings_select_admin"
  on public.moderation_settings
  for select
  to authenticated
  using (public.is_admin_user());

grant all privileges on table public.moderation_settings to service_role;
grant select on table public.moderation_settings to authenticated;

-- 初期値（要件 3.10.7・3.10.8）。既にあれば触らない
insert into public.moderation_settings (key, value) values
  ('auto_hide_reporters', '3'),            -- 異なる通報者が何人で自動非公開か
  ('unreliable_reporter_no_issue', '3'),   -- 直近 90 日に「問題なし」が何件以上の通報者を数えないか
  ('strike_expiry_days', '90'),            -- ストライクの失効までの日数
  ('strikes_to_suspend', '5'),             -- 何個で仮停止か
  ('restriction_days', '[0, 3, 7, 30]')    -- 有効 1・2・3・4 個のときの投稿禁止日数（0 は警告だけ）
on conflict (key) do nothing;

-- 追加した順（続き）: 20260927000003_spots_created_at

-- admin-shell-dashboard Task 2: spots.created_at（ダッシュボードの「最近のスポット」用）
-- 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
--       要件定義書 3.10.3
--
-- 【初心者向け】spots には作った日時が無く、「最近のスポット」「今週のスポット」を出せなかった。
-- 列を足し、既存の行はそのスポットへの最初の投稿の日時で埋める（投稿が無ければ now()）。

alter table public.spots add column if not exists created_at timestamptz not null default now();

update public.spots s
set created_at = p.first_post_at
from (
  select spot_id, min(created_at) as first_post_at
  from public.posts
  group by spot_id
) p
where p.spot_id = s.id;

create index if not exists spots_created_at_idx on public.spots (created_at desc);

-- 追加した順（続き）: 20260927000004_last_active_at

-- admin-shell-dashboard Task 3: 最終利用日（users.last_active_at）
-- 出典: docs/tasks/admin/admin-shell-dashboard/03-last-active.md
--       要件定義書 3.10.3「使った人（今日／今週）」・7.4
--
-- 【初心者向け】「今日／今週に使った人」を数えるための列。本人は users を display_name・avatar_url しか
-- 更新できない（20260908000008）ので、値は本人が直接書くのではなく、下の関数 touch_last_active() を
-- 「ログイン中の本人の行に now() を入れるだけ」の窓口として呼ぶ（security definer）。
-- 呼ぶ回数は関所（src/proxy.ts）が Cookie で 1 人 1 日 1 回に抑える。

alter table public.users add column if not exists last_active_at timestamptz;
create index if not exists users_last_active_at_idx on public.users (last_active_at desc);

create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.users set last_active_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated, service_role;

-- 追加した順（続き）: 20260927000005_admin_notifications

-- admin-shell-dashboard Task 4: 管理者への通知（通知の種類を 3 つ足す）
-- 出典: docs/tasks/admin/admin-shell-dashboard/04-admin-notifications.md
--       要件定義書 3.9.1「管理者への通知」
--
-- 【初心者向け】通知の種類は notifications.type の CHECK 制約で固定している（20260912000001 以降、足すたびに作り直す）。
--   admin_report      … 新しい通報（related_id = 通報 ID）
--   admin_auto_hidden … 投稿が自動で非公開になった（related_id = 投稿／コメント ID。#553 が作る）
--   admin_suspended   … 仮停止した（related_id = 利用者 ID。#556 が作る）
-- 送り先は is_admin = true の利用者全員。

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended'
  ));

notify pgrst, 'reload schema';

-- 追加した順（続き）: 20260927000006_user_management

-- user-management Task 2: 停止と解除・投稿の一括非公開・ストライクの取り消し
-- 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
--       要件定義書 3.10.9「利用者の管理」、3.9.1「本人への通知」
--
-- 【初心者向け】
--   1. posts.hidden_reason … なぜ非公開になったか。'moderation'（通報対応）／'suspension'（停止に伴う一括非公開）。
--      停止を解除したとき「停止で隠した分だけ」を戻せるように印を残す。自動非公開は #553 で別の列（auto_hidden_at）
--   2. 通知の種類に account_suspended / account_unsuspended（本人向け。related_id は本人の ID）

alter table public.posts add column if not exists hidden_reason text;
alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended'
  ));

notify pgrst, 'reload schema';

-- 追加した順（続き）: 20260927000007_moderation_action

-- strike-system Task 2: 本人への通知（moderation_action）
-- 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
--       要件定義書 3.9.1「本人への通知」（非公開化・削除・ストライク・投稿禁止のたびに理由を知らせる）
--
-- related_id は strikes.id（何を・なぜ・どの措置かは strikes の行から引く）

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action'
  ));

notify pgrst, 'reload schema';

-- 追加した順（続き）: 20260927000008_auto_hide

-- strike-system Task 3: 自動非公開（異なる通報者 3 人）
-- 出典: docs/tasks/safety/strike-system/03-auto-hide.md
--       要件定義書 3.10.8「自動で行う対応」・3.8.1
--
-- 【初心者向け】タスク文書では auto_hidden_at という別の列を足す案だったが、hidden_at を見て隠している場所が
-- 20 か所以上（RLS を含む）あり、全部に or 条件を足すと漏れが出る。そこで「隠す」のは今までどおり hidden_at、
-- 「誰の判断か」は hidden_reason で区別する（'auto' ＝ 自動。'moderation' ＝ 通報対応、'suspension' ＝ 停止）。
-- 「問題なし」で戻すときは hidden_reason = 'auto' の行だけ hidden_at を消す。コメントにも同じ列を足す。

alter table public.posts drop constraint if exists posts_hidden_reason_check;
alter table public.posts add constraint posts_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

alter table public.comments add column if not exists hidden_reason text;
alter table public.comments drop constraint if exists comments_hidden_reason_check;
alter table public.comments add constraint comments_hidden_reason_check
  check (hidden_reason is null or hidden_reason in ('moderation', 'suspension', 'auto'));

create index if not exists posts_hidden_reason_idx on public.posts (hidden_reason) where hidden_reason is not null;
create index if not exists comments_hidden_reason_idx on public.comments (hidden_reason) where hidden_reason is not null;

-- 追加した順（続き）: 20260927000009_spot_fix_request

-- strike-system Task 6: スポットの修正依頼（通知の種類 spot_fix_request）
-- 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
--       要件定義書 3.10.6「スポット情報の誤り」・3.10.13
--
-- related_id はスポット ID（タップで /spots/[id]/edit を開く）。管理者のメモは admin_actions（spot_fix_request）の note から引く

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'like', 'album_join', 'role_change', 'member_removed', 'new_owner', 'report_resolved',
    'itinerary_joined', 'itinerary_member_removed', 'comment_replied',
    'album_invited', 'itinerary_invited',
    'admin_report', 'admin_auto_hidden', 'admin_suspended',
    'account_suspended', 'account_unsuspended',
    'moderation_action',
    'spot_fix_request'
  ));

notify pgrst, 'reload schema';

-- 追加した順（続き）: 20260927000010_legal_documents

-- legal-documents Task 1: 規約のデータ（legal_documents・user_consents）と初期の本文
-- 出典: docs/tasks/admin/legal-documents/01-legal-data-and-pages.md
--       要件定義書 3.10.11「規約管理」・7.4
--
-- 【初心者向け】「同意した」という事実は、**何に**同意したかが分からなければ意味が無い。だから本文に版を持ち、
-- 同意の記録（user_consents）に版を残す。公開中の版は誰でも読める（未ログインの同意画面から読むため）。
-- 下記の初期データ（利用規約 1.0・個人情報保護方針 1.0）は **素案**。文面の最終確認は運営者が行うこと。

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  -- 利用者に見せる「変更の要点」（1〜3 行）
  summary text not null default '',
  -- 本文（Markdown）
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  published_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_kind_version_unique unique (kind, version)
);

create index if not exists legal_documents_kind_status_idx on public.legal_documents (kind, status);

alter table public.legal_documents enable row level security;

-- 公開中・過去の版は誰でも読める（下書きは管理者だけ）
drop policy if exists "legal_documents_select_published" on public.legal_documents;
create policy "legal_documents_select_published"
  on public.legal_documents
  for select
  to anon, authenticated
  using (status <> 'draft' or public.is_admin_user());

grant all privileges on table public.legal_documents to service_role;
grant select on table public.legal_documents to anon, authenticated;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  agreed_at timestamptz not null default now(),
  constraint user_consents_unique unique (user_id, kind, version)
);

create index if not exists user_consents_user_idx on public.user_consents (user_id, kind);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own" on public.user_consents;
create policy "user_consents_select_own"
  on public.user_consents
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user());

-- 書き込みは Route Handler が service_role で行う（本人が勝手に「同意済み」を作れないように）
grant all privileges on table public.user_consents to service_role;
grant select on table public.user_consents to authenticated;

-- 初期データ（素案）。既にあれば触らない
insert into public.legal_documents (kind, version, summary, body, status, published_at) values
(
  'terms', '1.0', '最初の版です。',
  $terms$# タビコエ 利用規約

この利用規約（以下「本規約」）は、タビコエ（以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用するものとします。

## 第1条（適用）

本規約は、本サービスの利用に関する運営者と利用者との一切の関係に適用されます。

## 第2条（アカウント）

1. 本サービスの利用には Google アカウントによる登録が必要です。
2. 利用者は自分のアカウントを適切に管理し、第三者に使わせてはなりません。
3. 退会すると、投稿・コメント・アルバムなどは投稿者名を伏せた形で残る場合があります。

## 第3条（投稿）

1. 利用者は、自分が訪れた場所についての写真・動画・感想などを投稿できます。
2. 投稿の著作権は投稿者に帰属します。ただし、運営者は本サービスの提供・宣伝のために必要な範囲で投稿を表示・複製できるものとします。
3. 位置情報は、利用者が地図で合わせたピンの座標を保存します。自宅など、公開すると困る場所を投稿しないよう注意してください。

## 第4条（禁止事項）

利用者は、次の行為をしてはなりません。

- 他人の個人情報（住所・電話番号・氏名など）を掲載すること
- 他人になりすますこと
- 虚偽の情報を投稿すること
- 著作権・肖像権など他人の権利を侵害すること
- スパム・宣伝を目的とした投稿やコメント
- 不適切な表現（誹謗中傷・差別・わいせつな内容など）
- 本サービスの運営を妨げること

## 第5条（通報と対応）

1. 利用者は、本規約に反する投稿・コメント・アカウントを通報できます。
2. 運営者は、通報された内容を確認し、非公開化・削除・アカウントの停止などの対応を行うことがあります。
3. 通報が一定数重なった投稿・コメントは、運営者が確認するまで自動的に非公開になることがあります。

## 第6条（違反の記録と制限）

1. 運営者が非公開化または削除を確定した場合、投稿者に違反の記録（ストライク）が 1 つ付きます。記録は付与から 90 日で失効します。
2. 有効な記録の数に応じて、次の制限を行います。1 つ目：警告、2 つ目：3 日間の投稿・コメント禁止、3 つ目：7 日間の投稿・コメント禁止、4 つ目：30 日間の投稿・コメント禁止、5 つ目：アカウントの停止。
3. 個人情報の掲載・なりすましは、1 回でアカウントの停止となることがあります。
4. 制限中も、閲覧・保存・しおりの機能は使えます。自分の状態はマイページの「アカウントの状態」で確認できます。

## 第7条（サービスの変更・停止）

運営者は、事前の通知なく本サービスの内容を変更し、または提供を停止することがあります。

## 第8条（免責）

1. 本サービスの投稿は利用者の主観に基づくものであり、運営者はその正確性を保証しません。
2. 本サービスの利用によって利用者に生じた損害について、運営者は故意または重大な過失がある場合を除き責任を負いません。

## 第9条（規約の変更）

運営者は本規約を変更することがあります。変更後の規約は本サービス上で公開し、利用者には次に本サービスを開いたときに改めて同意を求めます。

## 第10条（準拠法）

本規約は日本法に準拠します。
$terms$,
  'published', now()
),
(
  'privacy', '1.0', '最初の版です。',
  $privacy$# タビコエ 個人情報保護方針

タビコエ（以下「本サービス」）は、利用者の個人情報を次のとおり取り扱います。

## 1. 取得する情報

- Google アカウントの情報（メールアドレス・表示名・プロフィール画像）
- 利用者が登録・投稿した情報（表示名・アイコン・投稿・コメント・保存・しおり・アルバム）
- 投稿の位置情報（利用者が地図で合わせたピンの座標。端末の位置情報そのものは保存しません）
- 最終利用日（1 日 1 回だけ記録します）
- 違反の記録（ストライク。付与から 90 日で失効しますが、運営者の操作の記録には残ります）
- 通報の内容と、通報への対応の記録
- 利用状況の記録（ログイン・投稿・通報などの操作ログ。90 日で消します）

## 2. 利用の目的

- 本サービスの提供・運営・改善のため
- 利用者への通知（コメント・いいね・招待・運営からのお知らせ・違反への対応など）のため
- 不正・違反行為への対応と、本サービスの安全を保つため
- 利用状況の把握（利用者数・使った人の数など）のため

## 3. 第三者への提供

法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供しません。ただし、本サービスの提供に必要な範囲で、次の事業者に情報を預けます。

- Supabase（データベース・認証・画像の保管）
- Google（アカウント認証・地図）
- Vercel（アプリケーションの配信）

## 4. 位置情報

「近くのスポットを探す」「ここを投稿」「地図」を使うときに、端末の位置情報を利用します。許可は端末の標準の確認画面で行い、拒否しても行き先の入力などで代わりの操作ができます。

## 5. 公開範囲

公開設定の投稿は、本サービスの利用者全員に表示されます。非公開設定の投稿・下書きは本人（およびアルバムのメンバー）以外に表示しません。

## 6. 退会と削除

退会すると、アカウントの情報は削除または匿名化されます。投稿・コメントは投稿者名を伏せた形で残る場合があります。

## 7. 同意の記録

新規登録時に本方針と利用規約への同意を記録します。どの版にいつ同意したかを保持し、新しい版を公開したときは改めて同意を求めます。

## 8. お問い合わせ

個人情報の取り扱いに関するお問い合わせは、運営者までご連絡ください。

## 9. 方針の変更

本方針は変更することがあります。変更後の方針は本サービス上で公開します。
$privacy$,
  'published', now()
)
on conflict (kind, version) do nothing;
