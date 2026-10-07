-- #869: しおりの招待で「アルバムにも招待する」を選べるようにする
--
-- 【初心者向け】なぜ列が要るのか。
--   しおりに招待された人が「参加する」を押したとき、**アルバムにも入れるかどうか**は
--   送った人が決めたことです。押した時点ではもう送信画面は無いので、
--   **招待の行に覚えておく**必要があります。
--
-- 既定は true（アルバムにも招待する）。要件定義書 3.11.7 のとおり、
-- 送信画面のチェックは最初から入っていて、外せばしおりだけになります。
--
-- 【初心者向け】`not null default true` にしてあるので、**この列を当てる前に作られた
-- 招待の行**も自動で true になります（＝今までどおり送ったものはアルバムにも入る）。
alter table public.itinerary_invitations
  add column if not exists invite_to_album boolean not null default true;

comment on column public.itinerary_invitations.invite_to_album is
  '#869: 受諾時に同じ旅行のアルバムにも editor として加えるか。送信時にオーナーが決める（既定 true）';
