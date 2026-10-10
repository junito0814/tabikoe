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

~~本番ブランチは `main`。以後 `main` にマージすると自動でデプロイされ、PR ごとにプレビュー URL も作られる。~~
→ **2026-10-07 に変更**。卒業制作を提出し、担当の方が本番を触っている間は**壊さないことが最優先**になったため、
**本番ブランチを `submission` に固定した**（Vercel → Settings → Environments → Production → Branch Tracking）。

| ブランチ | 出る先 | 役割 |
|---|---|---|
| **`submission`** | 本番 `https://tabikoe.vercel.app` | **提出した版で固定。** 担当の方が触る。動かすのは意図したときだけ |
| **`main`** | Preview（PR ごとの URL） | 開発はこちら。**マージしても本番は変わらない** |

本番を更新したいときは `submission` を進めて、Vercel で Redeploy する。

## 2. 環境変数（Production と Preview で**別の Supabase を向ける**）

> **2026-10-09（#896）に変更。** それまでは Production も Preview も**同じ Supabase プロジェクト**を見ていた。
> 提出後は担当の方が本番を触っているので、**開発で作ったテスト投稿が担当の方の一覧に出る**、
> **掃除のスクリプトが担当の方のデータを消す**、が起きうる。そこで Supabase を 2 つに分けた。
>
> | | Supabase | 見ているもの |
> |---|---|---|
> | **Production** | 本番プロジェクト | 担当の方のデータ。**触らない** |
> | **Preview** | `tabikoe-dev` | 開発用。何をしてもよい |
>
> Vercel では**同じ名前の変数を環境ごとに別の行**にして値を分ける。
> 下の 3 つは Production と Preview で**値が違う**。残りは同じでよい。
>
> - `NEXT_PUBLIC_SUPABASE_URL`
> - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
> - `SUPABASE_SECRET_KEY`

| 変数 | 値 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` と同じ | ブラウザにも出る |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 同上 | 公開鍵。ブラウザにも出る |
| `SUPABASE_SECRET_KEY` | 同上 | **service_role。絶対に NEXT_PUBLIC を付けない** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 同上 | 表示用。リファラー制限で守る（4 節） |
| `GOOGLE_PLACES_API_KEY` | 同上 | サーバーのみ |
| `GOOGLE_GEOCODING_API_KEY` | 同上 | サーバーのみ |
| `GOOGLE_ROUTES_API_KEY` | 同上 | サーバーのみ。探すモードの車・電車・バスの所要時間（要件定義書 6.7）。無くても動く（直線距離の計算に切り替わる） |
| `VIDEO_UPLOAD_DISABLED` | **設定しない**（動画を受け付ける） | ~~`1`（実機で確かめるまで）~~ → **2026-10-10 に訂正**。この変数は**そもそも一度も設定されていなかった**（表には `1` と書いてあったが事実と違った）。`1` 以外・未設定なら**受け付ける**。<br>**受付を止めたい環境があれば、その環境にだけ `1` を設定する。** 止めると、投稿画面は「写真」とだけ書き、ファイル選択からも動画が外れる（言葉・`accept`・受付が 1 つの値で一緒に動く。#861） |

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
- スクリプトは `scripts/supabase-target.mjs` を通して繋ぎ先を決める。**既定は開発用**（`DEV_SUPABASE_*`）。本番に当てるには `--production` が要る（#896）。**キーを別の場所に書き写さない。** 手元に `.env.local` が無いときは、Vercel の環境変数から一時的にコピーし、終わったら消す
- 本番に対して実行するので、メールアドレスの打ち間違いに注意する。引数は 1 つしか受け付けない（複数人を巻き込んで消さないため）

## 注意

- `SUPABASE_SECRET_KEY` を漏らさない。Vercel の環境変数は Production / Preview / Development を分けて設定できる。
- ~~ステージングと本番で Supabase プロジェクトは同じものを使う（データも同じ）。ダミーデータは `[seed]` の目印付きで、`node scripts/seed/clean-seed.mjs` で消せる。~~
  → **2026-10-09 に廃止**（#896）。**Preview は `tabikoe-dev`、Production は本番**と分けた。目印の件も #776 で廃止済み（画面に出ていたため）で、いまは `scripts/seed/seed-ids.json` の控えで見分ける。
- 動画の投稿は `VIDEO_UPLOAD_DISABLED=1` の間は受け付けない。**2026-10-10 に受付を開けた**（#861）。
  画面の言葉・`accept`・サーバーの受付は**同じ 1 つの値から出している**ので、一緒に動く
  （`isVideoUploadDisabled()` → ページ → `PostComposeScreen` → `PostFormFields`）。手で揃える必要はない。
  **本番で止めたいときは、Vercel の環境変数で Production にだけ `1` を設定する。**
- **動画を有効にする前に、Preview で実際に 1 本投稿して確かめること**（2026-10-09・#861）。
  手元では `node_modules` があるので ffmpeg が動いてしまい、**本番だけ落ちる**たちの不具合が起きうる。
  実際 2026-10-09 に、`ffmpeg-static` が**どの関数にも同梱されていない**のを見つけた
  （`await import()` は Next.js の荷造りから辿れない）。`next.config.ts` の
  `outputFileTracingIncludes` で明示したが、**本番相当の環境で動かすまで「直った」としない**。

## 開発用の Supabase（#896・2026-10-09）

### 何のためにあるか

本番は担当の方が触っている。**開発で作ったテスト投稿が担当の方の一覧に出ない**ようにするために分けた。

| | 使う場面 |
|---|---|
| **本番プロジェクト** | `submission` ブランチのデプロイ（＝ `https://tabikoe.vercel.app`）だけ |
| **`tabikoe-dev`** | 手元の開発、Preview のデプロイ、seed、掃除のスクリプト |

### `.env.local` に要るもの

```
# 本番（読み書きしない。--production を付けたときだけ使う）
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...

# 開発用（スクリプトの既定の行き先）
DEV_SUPABASE_URL=...
DEV_SUPABASE_PUBLISHABLE_KEY=...
DEV_SUPABASE_SECRET_KEY=...
```

### スクリプトの繋ぎ先

**既定は開発用。** 本番に当てたいときだけ `--production` を付ける（赤い警告が出て 5 秒待つ）。

```bash
node scripts/seed/seed-tokyo.mjs                 # 開発用に入る
node scripts/seed/clean-seed.mjs --apply         # 開発用から消える
node scripts/seed/clean-seed.mjs --apply --production   # ★ 本番。担当の方が触っているので原則やらない
```

### もう 1 つ作り直すとき

```bash
node scripts/build-new-project-sql.mjs   # scripts/new-project/NN-migrations.sql が出来る
```

出来たファイルを、新しいプロジェクトの SQL Editor に**番号順に**貼って実行する。そのあと：

```bash
node scripts/compare-projects.mjs        # 本番と突き合わせて、表・バケットが揃っているか見る
```

Supabase 側で手作業が要るのは次の 3 つ（SQL では入らない）。

1. **Authentication → Sign In / Providers → Google** … 本番と同じ Client ID / Secret を入れる
2. **Authentication → URL Configuration** … Site URL `http://localhost:3000`、Redirect URLs に `http://localhost:3000/**` と `https://*.vercel.app/**`
3. **Google Cloud → 認証情報** … 開発用は**専用の OAuth クライアント**を作り（例: `tabikoe-dev`）、その
   **承認済みのリダイレクト URI** に `https://<新しい ref>.supabase.co/auth/v1/callback` を入れる。
   その Client ID / Secret を 1 の欄に入れる。**本番のクライアントには触らない**
   - 2026-10-09 に、開発用 Supabase へ**本番と同じ Client ID** を入れてしまい、Google に本番の
     クライアントとして要求が飛んで `redirect_uri_mismatch` になった。クライアントを分けること
   - 同じ Google Cloud プロジェクトの中にあれば、**同意画面（公開済み）は共用**なので追加の公開手続きは要らない

そのあと、自分を管理者にする（**画面からは付けられない**。要件 3.10.1）。

```bash
node scripts/grant-admin.mjs you@example.com --apply     # 開発用。先に一度ログインしておくこと
```

印を付けただけでは入れない。`/admin` を開くと認証アプリ（TOTP）の登録へ誘導されるので、6 桁まで通す。
**この操作は画面を通らないので操作の記録（3.10.12）に残らない。** 誰にいつ付けたかは別に控える。

> **バケットの設定は手でやらない。** 大きさ上限・受付形式はマイグレーションに書いてある（#896）。
> 管理画面で直すとコードとズレて、作り直したときに再現できなくなる。
