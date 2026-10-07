import type { InviteCandidate } from "@/lib/invitations/in-app";
import type { UserSummary } from "@/lib/users/search-users";
import { searchUsersRequest } from "@/components/invitations/InAppInvitePanel";
import { fetchWithAuthRedirect } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryDetail, ItineraryListItem } from "@/lib/itineraries/get-itinerary";

/**
 * しおり画面が呼ぶ API をまとめた口（単体テストではこの型を実装した偽物に差し替える）
 * 出典: docs/tasks/itinerary/*（各 Route Handler の仕様）
 *
 * 【初心者向け】画面ごとに fetch を書くと URL やヘッダーがばらつくので、ここに集約する。
 * どの関数も「失敗したら例外」ではなく Response をそのまま返し、画面側で status を見て文言を決める。
 */
export interface ItineraryApi {
  list: (spotId?: string | null) => Promise<{ items: ItineraryListItem[] }>;
  create: (input: { title: string; startDate: string | null; endDate: string | null }) => Promise<Response>;
  get: (id: string) => Promise<{ itinerary: ItineraryDetail }>;
  updatePeriod: (id: string, startDate: string | null, endDate: string | null) => Promise<Response>;
  rename: (id: string, title: string) => Promise<Response>;
  remove: (id: string) => Promise<Response>;
  addSpot: (id: string, spotId: string, dayIndex: number | null) => Promise<Response>;
  updateSpot: (
    id: string,
    spotId: string,
    patch: { dayIndex?: number | null; arrivalTime?: string | null; memo?: string | null; sortOrder?: number; checked?: boolean }
  ) => Promise<Response>;
  removeSpot: (id: string, spotId: string) => Promise<Response>;
  issueInvitation: (id: string) => Promise<Response>;
  listInvitations: (id: string) => Promise<{ invitations: { id: string; path: string; expiresAt: string; createdAt: string }[]; pending?: { id: string; inviteeUserId: string; inviteeName: string; expiresAt: string }[] }>;
  revokeInvitation: (id: string, invitationId: string) => Promise<Response>;
  /** v3.2: アプリ内招待（候補・検索・送信） */
  fetchInviteCandidates: (id: string) => Promise<{ candidates: InviteCandidate[] }>;
  searchUsers: (query: string) => Promise<{ users: UserSummary[] }>;
  /** #869: inviteToAlbum は「同じ旅行のアルバムにも招待するか」（既定は true） */
  sendInvitation: (id: string, inviteeUserId: string, inviteToAlbum?: boolean) => Promise<Response>;
  removeMember: (id: string, userId: string) => Promise<Response>;
  leave: (id: string) => Promise<Response>;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const defaultItineraryApi: ItineraryApi = {
  list: async (spotId) => readJson(await fetchWithAuthRedirect(`/api/itineraries${spotId ? `?spot=${encodeURIComponent(spotId)}` : ""}`)),
  create: (input) => fetchWithAuthRedirect("/api/itineraries", json(input)),
  get: async (id) => readJson(await fetchWithAuthRedirect(`/api/itineraries/${id}`)),
  updatePeriod: (id, startDate, endDate) => fetchWithAuthRedirect(`/api/itineraries/${id}`, patch({ startDate, endDate })),
  rename: (id, title) => fetchWithAuthRedirect(`/api/itineraries/${id}`, patch({ title })),
  remove: (id) => fetchWithAuthRedirect(`/api/itineraries/${id}`, { method: "DELETE" }),
  addSpot: (id, spotId, dayIndex) => fetchWithAuthRedirect(`/api/itineraries/${id}/spots`, json({ spotId, dayIndex })),
  updateSpot: (id, spotId, body) => fetchWithAuthRedirect(`/api/itineraries/${id}/spots/${spotId}`, patch(body)),
  removeSpot: (id, spotId) => fetchWithAuthRedirect(`/api/itineraries/${id}/spots/${spotId}`, { method: "DELETE" }),
  issueInvitation: (id) => fetchWithAuthRedirect(`/api/itineraries/${id}/invitations`, { method: "POST" }),
  listInvitations: async (id) => readJson(await fetchWithAuthRedirect(`/api/itineraries/${id}/invitations`)),
  revokeInvitation: (id, invitationId) => fetchWithAuthRedirect(`/api/itineraries/${id}/invitations/${invitationId}`, { method: "DELETE" }),
  fetchInviteCandidates: async (id) => readJson(await fetchWithAuthRedirect(`/api/itineraries/${id}/invite-candidates`)),
  searchUsers: searchUsersRequest,
  sendInvitation: (id, inviteeUserId, inviteToAlbum = true) =>
    fetchWithAuthRedirect(`/api/itineraries/${id}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteeUserId, inviteToAlbum }),
    }),
  removeMember: (id, userId) => fetchWithAuthRedirect(`/api/itineraries/${id}/members/${userId}`, { method: "DELETE" }),
  leave: (id) => fetchWithAuthRedirect(`/api/itineraries/${id}/members/me`, { method: "DELETE" }),
};
