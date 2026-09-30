# デプロイ手順（ステージング / 本番）

> 2026-09-25 作成。実機・屋外での確認（メンタリングの指摘）のために Vercel へ出す手順。

## なぜ localhost ではだめか

- 外に出ると Mac と同じ Wi-Fi に居ないので届かない。
- スマホから `http://` で開くと**安全な接続（secure context）ではない**ため、`navigator.geolocation` が使えない。現在地は本アプリの中心（探すモード・ここを投稿・徒歩 N 分）なので、確かめたいことが確かめられない。
- HTTPS で出せば、現在地・写真の選択・PWA 的な挙動まで実機と同じ条件になる。

## 1. Vercel にプロジェクトを作る

1. https://vercel.com/new で GitHub の `junito0814/tabikoe` を Import する
2. Framework は Next.js が自動で選ばれる。Root Directory はそのまま（リポジトリ直下）
3. Build Command・Output Directory は既定のまま（`next build`）
4. まだ Deploy は押さず、先に環境変数を入れる（次節）

本番ブランチは `main`。以後 `main` にマージすると自動でデプロイされ、PR ごとにプレビュー URL も作られる。

## 2. 環境変数（Production と Preview の両方に入れる）

| 変数 | 値 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` と同じ | ブラウザにも出る |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 同上 | 公開鍵。ブラウザにも出る |
| `SUPABASE_SECRET_KEY` | 同上 | **service_role。絶対に NEXT_PUBLIC を付けない** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 同上 | 表示用。リファラー制限で守る（4 節） |
| `GOOGLE_PLACES_API_KEY` | 同上 | サーバーのみ |
| `GOOGLE_GEOCODING_API_KEY` | 同上 | サーバーのみ |
| `GOOGLE_ROUTES_API_KEY` | 同上 | サーバーのみ。探すモードの車・電車・バスの所要時間（要件定義書 6.7）。無くても動く（直線距離の計算に切り替わる） |
| `VIDEO_UPLOAD_DISABLED` | `1`（当面） | 動画の変換に使う ffmpeg はサーバーレスでの実績が無いため、まずは止めて出す。写真は影響なし |

`.env.local` の値をそのまま貼る。値はどこにも書き残さない。

## 3. 認証（Google ログイン）のリダイレクト先を追加

デプロイ後の URL（例 `https://tabikoe.vercel.app`）が決まってから行う。

1. **Supabase**: Authentication → URL Configuration
   - Site URL に `https://<本番ドメイン>`
   - Redirect URLs に `https://<本番ドメイン>/api/auth/callback` と、プレビューを使うなら `https://*.vercel.app/api/auth/callback`
2. **Google Cloud**: APIs & Services → 認証情報 → OAuth 2.0 クライアント ID
   - 承認済みのリダイレクト URI に Supabase のコールバック（`https://<project-ref>.supabase.co/auth/v1/callback`）が入っていることを確認（既存のまま。ドメインが変わっても Supabase 経由なので追加は不要）
   - 承認済みの JavaScript 生成元に `https://<本番ドメイン>` を追加

## 4. Google Maps のキー制限にドメインを追加

Google Cloud → 認証情報 → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` のキー → アプリケーションの制限（HTTP リファラー）に次を追加。

```
https://<本番ドメイン>/*
https://*.vercel.app/*      ← プレビューも使う場合
```

Places・Geocoding のキーはサーバーからしか呼ばないので、IP 制限のままでよい（Vercel の IP は固定できないため、制限なし＋API 制限で運用する）。

## 5. 確認（デプロイ後、スマホで）

1. ログイン（「Google で続ける」→ ホーム）
2. ホームで現在地の許可を出し、「近くのスポットを探す」で現在地が取れる
3. 地図にピンが出る、吹き出しから一覧へ、戻るで地図へ
4. 「ここを投稿」で写真を撮って投稿できる
5. 検索（渋谷・新宿）→ スポット一覧 → 投稿一覧 → 投稿詳細 → 戻るが元の道を辿る

## 6. 屋外テストで見るところ

現在地の精度、「徒歩 N 分」の妥当性、地図の見やすさ（日差しの下）、写真を撮ってから投稿までの待ち時間、電波が弱いときの表示、片手で押しにくいボタン。

## 7. 管理者が認証アプリを失ったとき（2026-09-29 で追加）

管理画面に入るには二段階確認（認証アプリの 6 桁）が要る（要件定義書 3.10.1）。端末をなくすと**その管理者は自分では戻せない**。画面に「認証アプリを解除する」は置いていない。そこが二段階確認の抜け道になるため（乗っ取った人はまず二段階確認を外そうとする）。

復旧の道は 1 本だけ。サービスキーを持つ開発者が、手元から登録を消す。

```
node scripts/admin-mfa-reset.mjs <メールアドレス>
```

やること:

1. メールアドレスから利用者を引き、名前と「管理者かどうか」を出す
2. その人が持っている認証アプリの登録を一覧で出す（**秘密の文字列は出さない**）
3. `yes` と打たれたときだけ消す（`y` や `はい` では進まない）
4. 消した件数と日時を出す

消したあと、その管理者が次に `/admin` を開くと、二段階確認の登録（SC-32）からやり直せる。

### 注意すること

- **この操作は画面を通らないので、操作の記録（3.10.12）に残らない。** いつ・誰のを消したかを別に控えること（`is_admin` を付けるときと同じ扱い）
- スクリプトは `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SECRET_KEY` を読む。**キーを別の場所に書き写さない。** 手元に `.env.local` が無いときは、Vercel の環境変数から一時的にコピーし、終わったら消す
- 本番に対して実行するので、メールアドレスの打ち間違いに注意する。引数は 1 つしか受け付けない（複数人を巻き込んで消さないため）

## 8. ステージング環境を作る（2026-09-30 で追加）

**プレビューと手元の開発が、本番のデータを触らないようにする。** これまでは 1 つの Supabase プロジェクトを本番とプレビューと手元で共用していた。手元で試した投稿がそのまま本番に入るので、消し忘れると利用者に見える。

### 何が変わるか

| | これまで | これから |
|---|---|---|
| 本番（`tabikoe.vercel.app`） | 本番の Supabase | 本番の Supabase（変わらない） |
| プレビュー（PR ごと） | **本番の Supabase** | ステージングの Supabase |
| 手元（`npm run dev`） | **本番の Supabase** | ステージングの Supabase |

**手元が本番を触らなくなるのが、いちばん大きい。**

### 手順

**① Supabase で新しいプロジェクトを作る**

- 名前は `tabikoe-staging`
- リージョンは本番と同じにする
- データベースのパスワードを控える
- **無料枠は動いているプロジェクト 2 つまで**。本番とあわせてちょうど 2 つになる

**② テーブルを作る**

SQL エディタで **`scripts/setup_staging.sql`** を貼って実行する。`supabase/migrations/` の全 43 本をファイル名の順に並べたもので、テーブル・RLS・関数・ストレージのバケット・規約の初期データまで入る。

**本番のプロジェクトでは流さないこと**（すでに当たっているためエラーになる）。

**③ Google ログインを使えるようにする**

1. Supabase（新しい方）: Authentication → Sign In / Providers → Google を有効にし、**本番と同じ**クライアント ID とシークレットを入れる
2. Google Cloud: APIs & Services → 認証情報 → OAuth 2.0 クライアント ID の「承認済みのリダイレクト URI」に、**新しいプロジェクトの**コールバックを足す
   - `https://<新しい project-ref>.supabase.co/auth/v1/callback`
   - **本番のぶんは消さない。両方を並べて登録する**

**④ 戻り先を登録する**

Supabase（新しい方）: Authentication → URL Configuration

- Site URL: `http://localhost:3000`
- Redirect URLs に次を足す
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3001/api/auth/callback`（手元で別のポートを使うときのため）
  - `https://*.vercel.app/api/auth/callback`（プレビューは PR ごとに URL が変わるのでワイルドカード）

**⑤ Vercel の環境変数を Preview だけ差し替える**

Settings → Environment Variables で、次の 3 つを **Preview 環境だけ**ステージングの値にする。**Production は触らない。**

| 変数 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ステージングの URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ステージングの publishable キー |
| `SUPABASE_SECRET_KEY` | ステージングの secret キー |

Google のキー（Maps・Places・Geocoding・Routes）は本番と同じままでよい。

**⑥ 手元の `.env.local` もステージングに向ける**

同じ 3 つをステージングの値に書き換える。**これで手元の作業が本番に入らなくなる。**

**⑦ Google Maps のキー制限にプレビューのドメインを足す**

APIs & Services → 認証情報 → Maps のキー → HTTP リファラーの制限に `https://*.vercel.app/*` を足す。

**⑧ ダミーデータを入れる**

```
node scripts/seed/seed-tokyo.mjs
```

`.env.local` がステージングを向いているので、ステージングに入る。消すときは `node scripts/seed/clean-seed.mjs`。

**⑨ 自分を管理者にする**

ステージングで一度ログインしてから、SQL エディタで `users` の自分の行の `is_admin` を true にする（要件定義書 3.10.1）。

**⑩ 二段階確認を登録する**

ステージングは別のプロジェクトなので、**認証アプリの登録もやり直し**になる（`auth.mfa_factors` は共有されない）。`/admin` を開いて登録する。認証アプリには「タビコエ（ステージング）」のように分かる名前を付けると、本番のぶんと取り違えない。

### 気をつけること

- **無料プランのプロジェクトは、しばらく使わないと一時停止する。** 停止するとプレビューも手元も動かなくなる。管理画面から再開できるので、間があいたら作業前に開いて確かめる
- **ストレージ（写真・動画）も別々になる。** ステージングで投稿した写真は本番には無い
- **規約の初期データは ② で入る。** 本番とは別々に版を管理することになるので、文面を直したら両方に反映する
- **プレビューは Vercel のログインで守られたままにする。** ステージングのデータとはいえ、誰でも開ける状態にはしない

## 注意

- `SUPABASE_SECRET_KEY` を漏らさない。Vercel の環境変数は Production / Preview / Development を分けて設定できる。
- ~~ステージングと本番で Supabase プロジェクトは同じものを使う（データも同じ）~~ → **2026-09-30 に変更**。**本番とステージングで Supabase プロジェクトを分ける**（上記 8）。プレビューと手元はステージングを見るので、**手元の作業は本番に入らない**。ダミーデータは `[seed]` の目印付きで、`node scripts/seed/clean-seed.mjs` で消せる。
- 動画の投稿は `VIDEO_UPLOAD_DISABLED=1` の間は 503 を返す（画面にはその旨が出る）。
