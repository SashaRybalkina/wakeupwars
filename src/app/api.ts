export const BASE_URL = 'http://10.0.0.76:8000';
// blah
// export const BASE_URL = 'https://178c8ad26a44.ngrok-free.app';

export const endpoints = {
  // getToken
  login: `${BASE_URL}/api/login/`,
  token: `${BASE_URL}/api/token/`,
  tokenRefresh: `${BASE_URL}/api/token/refresh/`,
  register: `${BASE_URL}/api/register/`,
  groups: (userId: number) => `${BASE_URL}/api/user-groups/${userId}/`,
  getMatchingChallenges: (userId: number, categoryIds: number[], singOrMult: string) =>
  `${BASE_URL}/api/get-matching-challenges/${userId}/${categoryIds.join(',')}/${singOrMult}/`,

  friends: (userId: number) => `${BASE_URL}/api/user-friends/${userId}/`,
  cats: () => `${BASE_URL}/api/cats/`,
  collectBadge: () => `${BASE_URL}/api/collect-badge/`,
  collectBetCoins: () => `${BASE_URL}/api/collect-bet-coins/`,
  collectChallengeCoins: () => `${BASE_URL}/api/collect-challenge-coins/`,
  collectBetRefund: () => `${BASE_URL}/api/collect-bet-refund/`,
  someCats: (categoryIds: number[], singOrMult: string) =>
    `${BASE_URL}/api/some-cats/?ids=${categoryIds.join(",")}&sing_or_mult=${singOrMult}`,

  games: (catId: number, singOrMult: string) =>
    `${BASE_URL}/api/games/${catId}/${singOrMult}/`,
  singOrMultGames: (singOrMult: string) =>
    `${BASE_URL}/api/games/${singOrMult}/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  baseMemojies: () => `${BASE_URL}/api/base-memojies/`,
  extraMemojies: (userId: number, baseId: number) => `${BASE_URL}/api/extra-memojies/${userId}/${baseId}/`,
  purchaseMemoji: (userId: number, memojiId: number) => `${BASE_URL}/api/purchase-memoji/${userId}/${memojiId}/`,
  setCurrentMemoji: (userId: number) => `${BASE_URL}/api/set-current-memoji/${userId}/`,


  conversation: (userId: number, recipientId: number) => `${BASE_URL}/api/conversation/${userId}/${recipientId}/`,
  groupConversations: (userId: number) => `${BASE_URL}/api/user/${userId}/group-conversations/`,
  sendGroupMessage: (groupId: number) => `${BASE_URL}/api/messages/send/group/${groupId}/`,
  groupConversation: (userId: number, groupId: number) => `${BASE_URL}/api/conversation/group/${groupId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  getInitiator: (challId: number) =>
    `${BASE_URL}/api/get-initiator/${challId}/`,
  getNumCoins: (userId: number) =>
    `${BASE_URL}/api/get-num-coins/${userId}/`,
  groupProfile: (groupId: number) => `${BASE_URL}/api/groups/${groupId}/`,
  addGroupMember: (groupId: number) =>
    `${BASE_URL}/api/group-member-add/${groupId}/`,
  respondToBetInvite: () =>
    `${BASE_URL}/api/respond-to-bet-invite/`,
  challengeDetail: (challId: number) =>
    `${BASE_URL}/api/challenge-detail/${challId}/`,
  challengeReward: (challId:number)=> `${BASE_URL}/api/challenges/${challId}/reward/`,
  challengeList: (userId: number, whichChall: string) =>
    `${BASE_URL}/api/challenges/${userId}/${whichChall}/`,
  currentChallenges: (userId: number, whichChall: string) =>
    `${BASE_URL}/api/current-challenges/${userId}/${whichChall}/`,
  getPendingPublicChallenges: (userId: number) => `${BASE_URL}/api/get-pending-public-challenges/${userId}/`,
  getPublicChallenges: (userId: number) => `${BASE_URL}/api/get-public-challenges/${userId}/`,
  joinPublicChallenge: (userId: number) => `${BASE_URL}/api/join-public-challenge/${userId}/`,
  finalizePublicChallenge: () => `${BASE_URL}/api/finalize-public-challenge/`,
  // getCurrentPublicChallenges: (userId: number) => `${BASE_URL}/api/challenges/${userId}/`,
  getPersonalChallenges: (userId: number) => `${BASE_URL}/api/get-personal-challenges/${userId}/`,
  challengeSchedule: (challId: number) =>
    `${BASE_URL}/api/challenge-schedule/${challId}/`,
  getChallengeSchedule: (challId: number) =>
    `${BASE_URL}/api/get-challenge-schedule/${challId}/`,
  getChallengeBets: (challId: number, userId: number) =>
  `${BASE_URL}/api/get-challenge-bets/${challId}/${userId}/`,
  getChallengeUserSchedule: (challId: number, userId: number) =>
    `${BASE_URL}/api/get-challenge-user-schedule/${challId}/${userId}/`,
  getHasSetAlarms: (challId: number, userId: number) => `${BASE_URL}/api/get-has-set-alarms/${challId}/${userId}/`,
  setUserHasSetAlarms: (challId: number, userId: number) => `${BASE_URL}/api/set-user-has-set-alarms/${challId}/${userId}/`,
  createManualGroupChallenge: `${BASE_URL}/api/create-manual-group-challenge/`,
  createPendingCollaborativeGroupChallenge: () =>
    `${BASE_URL}/api/create-pending-collaborative-group-challenge/`,
  createPublicChallenge: `${BASE_URL}/api/create-public-challenge/`,
  finalizeCollaborativeGroupChallengeSchedule: (challId: number) =>
    `${BASE_URL}/api/finalize-collaborative-group-challenge-schedule/${challId}/`,
  allUsers: () => `${BASE_URL}/api/profile/all/`,
  sendFriendRequest: () => `${BASE_URL}/api/friend-request/send/`,
  friendRequests: (userId: number) =>
    `${BASE_URL}/api/friend-requests/${userId}/`,
  sendGroupInvite: () => `${BASE_URL}/api/groups/invite/`,
  groupInvites: (userId: number) =>
    `${BASE_URL}/api/group-invites/${userId}/`,
  respondToGroupInvite: (inviteId: number) =>
    `${BASE_URL}/api/groups/invite/respond/${inviteId}/`,
  getChallengeInvites: (userId: number, groupId: number) =>
    `${BASE_URL}/api/get-challenge-invites/${userId}/${groupId}/`,
  // challengeInvites: (userId: number, groupId: number) => `${BASE_URL}/api/challenge-invites/${userId}/${groupId}/`,

  // pendingChallenges: (groupId: number) => `${BASE_URL}/api/get-pending-challenges/${groupId}/`,
  getAvailabilities: (challId: number, userId: number) =>
    `${BASE_URL}/api/get-availabilities/${challId}/${userId}/`,
  setUserAvailability: (userId: number) => `${BASE_URL}/api/set-user-availability/${userId}/`,
  getUserAvailability: (userId: number) => `${BASE_URL}/api/get-user-availability/${userId}/`,
  setChallAvailability: (userId: number, challId: number) =>
    `${BASE_URL}/api/set-chall-availability/${userId}/${challId}/`,
  declineChallengeInvite: (userId: number, challId: number) =>
    `${BASE_URL}/api/decline-challenge-invite/${userId}/${challId}/`,

  sentFriendRequests: (userId: number) =>
    `${BASE_URL}/api/friend-requests-sent/${userId}/`,
  respondToFriendRequest: (requestId: number) =>
    `${BASE_URL}/api/friend-request/respond/${requestId}/`,
  cancelFriendRequest: (requestId: number) =>
    `${BASE_URL}/api/friend-request/delete/${requestId}/`,
  createGroup: `${BASE_URL}/api/create-group/`,
  createSudokuGame: `${BASE_URL}/api/sudoku/create/`,
  validateSudokuMove: `${BASE_URL}/api/sudoku/validate/`,
  finalizeSudokuResult: `${BASE_URL}/api/sudoku/finalize/`,
  createWordleGame: `${BASE_URL}/api/wordle/create/`,
  validateWordleMove: `${BASE_URL}/api/wordle/validate/`,
  wordleFinalize: `${BASE_URL}/api/wordle/finalize/`,
  typingRaceCreate: `${BASE_URL}/api/typing-race/create/`,
  typingRaceFinalize: `${BASE_URL}/api/typing-race/finalize/`,

  notifications: (userId: number) => `${BASE_URL}/api/notifications/${userId}/`,
  sendNotification: `${BASE_URL}/api/notifications/send/`,

  createPersonalChallenge: `${BASE_URL}/api/create-personal-challenge/`,
  leaderboard: (id: number) => `${BASE_URL}/api/challenge-leaderboard/${id}/`,
  groupLeaderboard: (groupId: number) => `${BASE_URL}/api/group-leaderboard/${groupId}/`,
  getPerformances: (challId: number) =>
    `${BASE_URL}/api/get-performances/${challId}/`,
  submitGameScores: () => `${BASE_URL}/api/submit-game-scores/`,
  addGameToSchedule: () => `${BASE_URL}/api/add-game-to-schedule/`,
  skillLevels: () => `${BASE_URL}/api/skill-levels/`,
  userData: (userId: number) => `${BASE_URL}/api/user-data/${userId}/`,
  badges: (userId: number) => `${BASE_URL}/api/badges/${userId}/`,
  skillLevelDetail: (categoryId: number) => `${BASE_URL}/api/skill-levels/${categoryId}/detail/`,
  skillLevelHistory: (categoryId: number, limit = 200) => `${BASE_URL}/api/skill-levels/${categoryId}/history/?limit=${limit}`,
  // Pattern (REST)
  patternCreate: `${BASE_URL}/api/pattern/create/`,
  patternValidate: `${BASE_URL}/api/pattern/validate/`,
  csrfToken: `${BASE_URL}/api/csrf-token/`,
  gameTimerExpired: `${BASE_URL}/api/game/timer-expired/`,

  sendBet: () => `${BASE_URL}/api/send-bet/`,

  myObligations: () => `${BASE_URL}/api/obligations/me/`,

  payExternal: (id: number) =>
    `${BASE_URL}/api/obligations/${id}/pay_external/`,
  payCash: (id: number) => `${BASE_URL}/api/obligations/${id}/pay_cash/`,
  payCustom: (id: number) => `${BASE_URL}/api/obligations/${id}/pay_custom/`,
  confirmPayment: (id: number) => `${BASE_URL}/api/payments/${id}/confirm/`,
  rejectPayment: (id: number) => `${BASE_URL}/api/payments/${id}/reject/`,

  //shareChallenge: (challId: number) => `${BASE_URL}/api/share-challenge/${challId}/`,
  getPersonalChallengeInvites: (userId: number) =>`${BASE_URL}/api/get-personal-challenge-invites/${userId}/`,
  acceptPersonalChallenge: (userId: number, challId: number) =>`${BASE_URL}/api/accept-personal-challenge/${userId}/${challId}/`,
  declinePersonalChallenge: (userId: number, challId: number) =>`${BASE_URL}/api/decline-personal-challenge/${userId}/${challId}/`,
  shareChallenge: (challId?: number) =>
  challId
    ? `${BASE_URL}/api/share-challenge/${challId}/` 
    : `${BASE_URL}/api/share-challenge/`,          
};

export const groupLeaderboardHistory = (
  groupId: number,
  start?: string,
  end?: string,
) => {
  const url = new URL(
    `/api/group-leaderboard/${groupId}/history/`,
    BASE_URL,
  );
  if (start) url.searchParams.set('start', start);
  if (end) url.searchParams.set('end', end);
  return url.toString();
};

export const leaderboardHistory = (
  challId: number,
  start?: string,
  end?: string,
) => {
  const url = new URL(
    `/api/challenge-leaderboard/${challId}/history/`,
    BASE_URL,
  );
  if (start) url.searchParams.set('start', start);
  if (end) url.searchParams.set('end', end);
  return url.toString();
};

type FetchOpts = RequestInit & { timeoutMs?: number };

export async function fetchJSON<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { timeoutMs = 12000, headers, ...rest } = opts;
  const h: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    Connection: 'close',
    ...((headers as any) || {}),
  };

  const attempt = async () => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, headers: h, signal: controller.signal } as any);
      if (!res.ok) {
        // retry server errors
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      try {
        return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
      } catch (e) {
        // sometimes proxy returns partial frames; trigger retry
        throw new Error('Bad JSON');
      }
    } finally {
      clearTimeout(t);
    }
  };

  const maxTries = 3;
  let lastErr: any;
  for (let i = 0; i < maxTries; i++) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}