import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeVisitFindings } from "@/lib/spots/visit-findings-db";
import { VisitFindingsPanel } from "./VisitFindingsPanel";

/**
 * #929: スポット画面に「行ってわかったこと」を出す入れ物
 * 出典: Issue #929、要件定義書 4.5.19・3.4.2
 *
 * 【初心者向け】数えるのはサーバーの仕事なので、ここ（Server Component）で数えて、
 * 開け閉めだけを画面側（VisitFindingsPanel）にまかせます。Google の公式情報（OfficialInfo）と
 * 同じ形にしてあります ── **取れなくても画面は出す**（Suspense の fallback は null）。
 */
async function VisitFindings({ spotId }: { spotId: string }) {
  const summaries = await summarizeVisitFindings(createAdminClient(), spotId);
  return <VisitFindingsPanel summaries={summaries} />;
}

export function visitFindingsSlot(spotId: string) {
  return (
    <Suspense fallback={null}>
      <VisitFindings spotId={spotId} />
    </Suspense>
  );
}
