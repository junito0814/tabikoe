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

## 注意

- `SUPABASE_SECRET_KEY` を漏らさない。Vercel の環境変数は Production / Preview / Development を分けて設定できる。
- ステージングと本番で Supabase プロジェクトは同じものを使う（データも同じ）。ダミーデータは `[seed]` の目印付きで、`node scripts/seed/clean-seed.mjs` で消せる。
- 動画の投稿は `VIDEO_UPLOAD_DISABLED=1` の間は 503 を返す（画面にはその旨が出る）。
