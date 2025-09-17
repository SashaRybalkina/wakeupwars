export const BASE_URL = 'https://7ea9395b9bbf.ngrok-free.app';

export const endpoints = {
  // getToken
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: (userId: number) => `${BASE_URL}/api/user-groups/${userId}/`,
  friends: (userId: number) => `${BASE_URL}/api/user-friends/${userId}/`,
  cats: () => `${BASE_URL}/api/cats/`,
  games: (catId: number, singOrMult: string) => `${BASE_URL}/api/games/${catId}/${singOrMult}/`,
  singOrMultGames: (singOrMult: string) => `${BASE_URL}/api/games/${singOrMult}/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  getInitiator: (challId: number) => `${BASE_URL}/api/get-initiator/${challId}/`,
  groupProfile: (groupId: number) => `${BASE_URL}/api/groups/${groupId}/`,
  addGroupMember: (groupId: number) => `${BASE_URL}/api/group-member-add/${groupId}/`,
  challengeDetail: (challId: number) => `${BASE_URL}/api/challenge-detail/${challId}/`,
  challengeList: (userId: number, whichChall: string) => `${BASE_URL}/api/challenges/${userId}/${whichChall}/`,
  challengeSchedule: (challId: number) => `${BASE_URL}/api/challenge-schedule/${challId}/`,
  getChallengeSchedule: (challId: number) => `${BASE_URL}/api/get-challenge-schedule/${challId}/`,
  createManualGroupChallenge: `${BASE_URL}/api/create-manual-group-challenge/`,
  createPendingCollaborativeGroupChallenge: () => `${BASE_URL}/api/create-pending-collaborative-group-challenge/`,
  createPublicChallenge: `${BASE_URL}/api/create-public-challenge/`,
  finalizeCollaborativeGroupChallengeSchedule: (challId: number) => `${BASE_URL}/api/finalize-collaborative-group-challenge-schedule/${challId}/`,
  allUsers: () => `${BASE_URL}/api/profile/all/`,
  sendFriendRequest: () => `${BASE_URL}/api/friend-request/send/`,
  friendRequests: (userId: number) => `${BASE_URL}/api/friend-requests/${userId}/`,
  getChallengeInvites: (userId: number, groupId: number) => `${BASE_URL}/api/get-challenge-invites/${userId}/${groupId}/`,
  // challengeInvites: (userId: number, groupId: number) => `${BASE_URL}/api/challenge-invites/${userId}/${groupId}/`,

  // pendingChallenges: (groupId: number) => `${BASE_URL}/api/get-pending-challenges/${groupId}/`,
  getAvailabilities: (challId: number) => `${BASE_URL}/api/get-availabilities/${challId}/`,
  setUserAvailability: (userId: number, challId: number) => `${BASE_URL}/api/set-availability/${userId}/${challId}/`,
  declineChallengeInvite: (userId: number, challId: number) => `${BASE_URL}/api/decline-challenge-invite/${userId}/${challId}/`,

  sentFriendRequests: (userId: number) => `${BASE_URL}/api/friend-requests-sent/${userId}/`,
  respondToFriendRequest: (requestId: number) => `${BASE_URL}/api/friend-request/respond/${requestId}/`,
  cancelFriendRequest: (requestId: number) => `${BASE_URL}/api/friend-request/delete/${requestId}/`,
  createGroup: `${BASE_URL}/api/create-group/`,
  createSudokuGame: `${BASE_URL}/api/sudoku/create/`,
  validateSudokuMove: `${BASE_URL}/api/sudoku/validate/`,
  createWordleGame: `${BASE_URL}/api/create-wordle/`,
  validateWordleMove: `${BASE_URL}/api/wordle/validate/`,
  
  createPersonalChallenge: `${BASE_URL}/api/create-personal-challenge/`,
  leaderboard: (id: number) => `${BASE_URL}/api/challenge-leaderboard/${id}/`,
  submitGameScores: () => `${BASE_URL}/api/submit-game-scores/`,
  addGameToSchedule: () => `${BASE_URL}/api/add-game-to-schedule/`,
  skillLevels: () => `${BASE_URL}/api/skill-levels/`,
  // Pattern (REST)
  patternCreate: `${BASE_URL}/api/pattern/create/`,
  patternValidate: `${BASE_URL}/api/pattern/validate/`,
  csrfToken: `${BASE_URL}/api/csrf-token/`,


  myObligations: () => `${BASE_URL}/api/obligations/me/`,
  payExternal: (id: number) => `${BASE_URL}/api/obligations/${id}/pay_external/`,
  payCash: (id: number) => `${BASE_URL}/api/obligations/${id}/pay_cash/`,
  confirmPayment: (id: number) => `${BASE_URL}/api/payments/${id}/confirm/`,
  rejectPayment: (id: number) => `${BASE_URL}/api/payments/${id}/reject/`,
};

export const leaderboardHistory = (
  challId: number,
  start?: string,
  end?: string,
) => {
  const url = new URL(`/api/challenge-leaderboard/${challId}/history/`, BASE_URL);
  if (start) url.searchParams.set("start", start);
  if (end)   url.searchParams.set("end",   end);
  return url.toString();
};


