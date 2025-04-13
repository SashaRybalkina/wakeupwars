export const BASE_URL = 'https://824a-216-162-223-194.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: `${BASE_URL}/api/groups/`,
  cats: (singOrMult: string) => `${BASE_URL}/api/cats/${singOrMult}/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  groupProfile: (groupId: number) => `${BASE_URL}/api/groups/${groupId}/`,
};