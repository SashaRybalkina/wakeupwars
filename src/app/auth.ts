/**
 * @file index.tsx
 * @description Handles user authentication.
 */


import * as SecureStore from "expo-secure-store";
import { BASE_URL, endpoints } from "./api"

import { jwtDecode } from "jwt-decode";

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    const decoded: any = jwtDecode(token);
    return decoded?.exp * 1000 < Date.now();
  } catch (e) {
    console.error("Failed to decode token", e);
    return true;
  }
}


let refreshPromise: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  let access = await SecureStore.getItemAsync("access");
  const refresh = await SecureStore.getItemAsync("refresh");

  if (!isTokenExpired(access)) {
    console.log("returning access")
    return access;
  }

  else if (refresh) {
    if (refreshPromise) {
      return await refreshPromise;
    }

    // Otherwise, start a new refresh
    refreshPromise = (async () => {
      try {
        const res = await fetch(endpoints.tokenRefresh, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });

        if (!res.ok) return null;

        const contentType = res.headers.get("content-type");
        let data;
        if (contentType?.includes("application/json")) {
          data = await res.json();
        } else {
          console.error("Expected JSON but got:", await res.text());
          return null;
        }

        const newAccess = data.access;

        if (newAccess) {
          await SecureStore.setItemAsync("access", newAccess);
          console.log("Token refreshed:", newAccess.slice(0, 20));
        }

        return newAccess ?? null;
      } catch (err) {
        console.error("Refresh token failed", err);
        return null;
      } finally {
        refreshPromise = null; // Unlock
      }
    })();

    return await refreshPromise;
  }
      
  else {
    console.log("access expired and refresh null")
    return null;
  }
}


