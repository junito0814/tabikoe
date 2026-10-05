import { describe, expect, it } from "vitest";
import {
  OPERATION_LOG_RETENTION_DAYS,
  isAuthorizedCronRequest,
  operationLogCutoff,
} from "./operation-log-retention";

/**
 * 出典: #714（操作ログの 90 日削除を入れる）単体テスト
 * 要件定義書 7.5・個人情報保護方針 1.1「5. 保存期間」
 */
describe("operationLogCutoff", () => {
  it("90 日前を境目にする", () => {
    expect(OPERATION_LOG_RETENTION_DAYS).toBe(90);
    const now = new Date("2026-10-05T00:00:00.000Z");
    expect(operationLogCutoff(now).toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("渡した時刻を書き換えない", () => {
    const now = new Date("2026-10-05T00:00:00.000Z");
    operationLogCutoff(now);
    expect(now.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

/**
 * 【初心者向け】この窓口は行を消すので、誰でも開けると困る。
 * いちばん怖いのは「合言葉を設定し忘れたまま公開されること」なので、そこを重点的に見る。
 */
describe("isAuthorizedCronRequest", () => {
  it("合言葉が合えば通す", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("合言葉が設定されていなければ、誰も通さない", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", undefined)).toBe(false);
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
  });

  it("違う合言葉・付け忘れは通さない", () => {
    expect(isAuthorizedCronRequest("Bearer wrong", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest(null, "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("s3cret", "s3cret")).toBe(false);
  });
});
