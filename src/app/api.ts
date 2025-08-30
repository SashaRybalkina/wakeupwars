export const BASE_URL = 'https://bb8711827311.ngrok-free.app';

export const endpoints = {
  // getToken
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: (userId: number) => `${BASE_URL}/api/user-groups/${userId}/`,
  friends: (userId: number) => `${BASE_URL}/api/user-friends/${userId}/`,
  cats: (singOrMult: string) => `${BASE_URL}/api/cats/${singOrMult}/`,
  games: (catId: number) => `${BASE_URL}/api/games/${catId}/`,
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
  hasChallengeInvites: (userId: number, groupId: number) => `${BASE_URL}/api/has-challenge-invites/${userId}/${groupId}/`,
  challengeInvites: (userId: number, groupId: number) => `${BASE_URL}/api/challenge-invites/${userId}/${groupId}/`,

  getAvailabilities: (challId: number) => `${BASE_URL}/api/get-availabilities/${challId}/`,
  setUserAvailability: (userId: number, challId: number) => `${BASE_URL}/api/set-availability/${userId}/${challId}/`,

  sentFriendRequests: (userId: number) => `${BASE_URL}/api/friend-requests-sent/${userId}/`,
  respondToFriendRequest: (requestId: number) => `${BASE_URL}/api/friend-request/respond/${requestId}/`,
  cancelFriendRequest: (requestId: number) => `${BASE_URL}/api/friend-request/delete/${requestId}/`,
  createGroup: `${BASE_URL}/api/create-group/`,
  createSudokuGame: `${BASE_URL}/api/sudoku/create/`,
  validateSudokuMove: `${BASE_URL}/api/sudoku/validate/`,
  createPersonalChallenge: `${BASE_URL}/api/create-personal-challenge/`,
};

