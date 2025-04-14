export const BASE_URL = 'https://824a-216-162-223-194.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: (userId: number) => `${BASE_URL}/api/user-groups/${userId}/`,
  cats: (singOrMult: string) => `${BASE_URL}/api/cats/${singOrMult}/`,
  games: (catId: number) => `${BASE_URL}/api/games/${catId}/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  groupProfile: (groupId: number) => `${BASE_URL}/api/groups/${groupId}/`,
};