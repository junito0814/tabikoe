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
