import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * 出典: #714（操作ログの 90 日削除を入れる）単体テスト
 *
 * 【初心者向け】`vercel.json` の `crons` が消えると、**消す処理が動かなくなる**。
 * それでも画面は普通に動くので気づけない。だから機械に見張らせる。
 * 個人情報保護方針 1.1 に「操作の記録 90 日」と書いて公開するので、ここが効かないと
 * また「やっていないことを書いている」状態に戻る。
 */
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  crons?: { path: string; schedule: string }[];
};

describe("操作ログを毎日消す（#714）", () => {
  it("vercel.json に毎日の予定が入っている", () => {
    const cron = config.crons?.find((item) => item.path === "/api/cron/purge-operation-logs");
    expect(cron).toBeDefined();
    // 0 18 * * * ＝ 毎日 UTC 18 時（日本時間の 3 時）。無料枠では 1 日 1 回まで
    expect(cron!.schedule).toBe("0 18 * * *");
  });

  it("消すのは操作ログだけ（運営者の対応の記録は消さない）", () => {
    const source = readFileSync("src/app/api/cron/purge-operation-logs/route.ts", "utf8");
    // 触っている表を全部数える。operation_logs 以外が増えていたら落とす
    // （admin_actions は方針 5. で「消しません」と書いてある）
    expect(source.match(/\.from\("[^"]+"\)/g)).toEqual(['.from("operation_logs")']);
  });
});
