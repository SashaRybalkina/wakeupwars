export const BASE_URL = 'https://6263283334aa.ngrok-free.app';


export const endpoints = {
  // getToken
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: (userId: number) => `${BASE_URL}/api/user-groups/${userId}/`,
  friends: (userId: number) => `${BASE_URL}/api/user-friends/${userId}/`,
  cats: () => `${BASE_URL}/api/cats/`,
  games: (catId: number, singOrMult: string) => `${BASE_URL}/api/games/${catId}/${singOrMult}/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  groupProfile: (groupId: number) => `${BASE_URL}/api/groups/${groupId}/`,
  addGroupMember: (groupId: number) => `${BASE_URL}/api/group-member-add/${groupId}/`,
  challengeDetail: (challId: number) => `${BASE_URL}/api/challenge-detail/${challId}/`,
  challengeList: (userId: number, whichChall: string) => `${BASE_URL}/api/challenges/${userId}/${whichChall}/`,
  challengeSchedule: (challId: number) => `${BASE_URL}/api/challenge-schedule/${challId}/`,
  createGroupChallenge: `${BASE_URL}/api/create-group-challenge/`,
  createPendingGroupChallenge: `${BASE_URL}/api/create-pending-group-challenge/`,
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
  createPersonalChallenge: `${BASE_URL}/api/create-personal-challenge/`,
  leaderboard: (id: number) => `${BASE_URL}/api/challenge-leaderboard/${id}/`,
  submitGameScores: () => `${BASE_URL}/api/submit-game-scores/`,
  // Pattern (REST)
  patternCreate: `${BASE_URL}/api/pattern/create/`,
  patternValidate: `${BASE_URL}/api/pattern/validate/`,
  csrfToken: `${BASE_URL}/api/csrf-token/`,

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


