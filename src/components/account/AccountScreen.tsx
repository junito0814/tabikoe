"use client";

import { useState, type ReactNode } from "react";
import { BackLink } from "@/components/layout/BackLink";
import { Sheet } from "@/components/ui/Sheet";
import { SettingGroup, SettingRow } from "./SettingRow";

/**
 * #799・#783（2026-10-06）: アカウント画面（SC-07）を行の形にする
 * 出典: Issue #799「文字リンクを操作に使わない決まりを足し、アカウント画面を行の形にする」
 *       Issue #783「Bug 3: 「アカウント」に戻るが無い。見出しの重複、効かない「保存」」
 *       要件定義書 4.5.16「文字リンク（下線）の使い分け」
 *
 * 【初心者向け】以前はこの画面に、アイコン・名前の入力欄・ブロック一覧・ログアウト・退会が
 * **縦に全部出て**いました。「画像を選択」「ログアウト」「退会する」は**下線の文字リンク**です。
 * 下線は Web ページの作法で、スマホのアプリでは行かボタンにします（要件 4.5.16）。
 *
 * iOS の「設定」と同じ**行の形**にしました。中身（名前・画像・ブロック）はシートで開きます。
 * 一度に見えるものが減り、「ここで何ができるか」が一目で分かります。
 *
 * **戻るが無かった**（#783。要件 4.5.13 違反）ので、左上に「‹ マイページ」を置きます。
 */
export function AccountScreen({
  displayName,
  blockedCount,
  isAdmin,
  profileForm,
  blockedList,
  logoutButton,
  deleteDialog,
}: {
  displayName: string;
  blockedCount: number;
  isAdmin: boolean;
  /** 名前と画像の編集（シートの中に入れる） */
  profileForm: ReactNode;
  /** ブロック中のユーザーの一覧（シートの中に入れる） */
  blockedList: ReactNode;
  logoutButton: ReactNode;
  deleteDialog: ReactNode;
}) {
  const [sheet, setSheet] = useState<"profile" | "blocked" | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pb-24 pt-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <header className="flex flex-col gap-2">
          {/* #783: 戻るが無かった（要件 4.5.13） */}
          <BackLink href="/mypage" label="マイページ" />
          <h1 className="text-[1.125rem] font-bold text-ink">アカウント</h1>
        </header>

        <SettingGroup>
          <SettingRow label="名前と画像" value={displayName || "未設定"} onClick={() => setSheet("profile")} />
          <SettingRow label="ブロック中のユーザー" value={`${blockedCount} 人`} onClick={() => setSheet("blocked")} />
        </SettingGroup>

        <SettingGroup>
          {/* #792: 規約は「別の画面へ行く」ので行（戻ると「‹ アカウント」） */}
          <SettingRow label="利用規約" href="/terms?back=%2Faccount" />
          <SettingRow label="プライバシーポリシー" href="/privacy?back=%2Faccount" />
        </SettingGroup>

        {/* menu-bar Task3: 管理画面への導線はメニューバーには置かず、管理者にだけここで出す（4.2・3.10.1） */}
        {isAdmin && (
          <SettingGroup>
            <SettingRow label="管理者ダッシュボード" href="/admin" />
          </SettingGroup>
        )}

        {/* ログアウト・退会は「その場で何かする」ので「›」を出さない。退会は取り返しがつかないので赤 */}
        <SettingGroup>
          <li className="border-b border-line last:border-b-0">
            <div className="flex min-h-12 items-center px-4 py-3">{logoutButton}</div>
          </li>
          <li className="border-b border-line last:border-b-0">
            <div className="flex min-h-12 items-center px-4 py-3">{deleteDialog}</div>
          </li>
        </SettingGroup>
      </div>

      <Sheet open={sheet === "profile"} title="名前と画像" onClose={() => setSheet(null)}>
        <div className="flex flex-col items-center gap-5 pb-2">{profileForm}</div>
      </Sheet>
      <Sheet open={sheet === "blocked"} title="ブロック中のユーザー" onClose={() => setSheet(null)}>
        {blockedList}
      </Sheet>
    </div>
  );
}
