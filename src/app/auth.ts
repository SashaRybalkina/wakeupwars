import * as SecureStore from "expo-secure-store";
import { BASE_URL, endpoints } from "./api"

export async function getAccessToken(): Promise<string | null> {
  let access = await SecureStore.getItemAsync("access");
  const refresh = await SecureStore.getItemAsync("refresh");

  if (!access && refresh) {
    // Try refreshing
    const res = await fetch(endpoints.tokenRefresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (res.ok) {
      const data = await res.json();
      access = data.access;
      await SecureStore.setItemAsync("access", access);
    } else {
      await logout();
    }
  }
  return access;
}

export async function logout() {
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
}


