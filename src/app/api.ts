export const BASE_URL = 'https://6421-2601-681-5400-4f70-7d1b-ca84-167a-e04d.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: `${BASE_URL}/api/groups/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
};