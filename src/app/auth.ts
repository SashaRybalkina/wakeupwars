import * as SecureStore from "expo-secure-store";
import { BASE_URL, endpoints } from "./api"


import jwt_decode from "jwt-decode";

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    // @ts-ignore
    const decoded: { exp: number } = jwt_decode(token);
    // exp is in seconds, Date.now() is in ms
    return decoded.exp * 1000 < Date.now();
  } catch (e) {
    // If decoding fails, consider token invalid
    return true;
  }
}




export async function getAccessToken(): Promise<string | null> {
  let access = await SecureStore.getItemAsync("access");
  const refresh = await SecureStore.getItemAsync("refresh");

  if (isTokenExpired(access) && refresh) {
    try {
      const res = await fetch(endpoints.tokenRefresh, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        // await logout();
        return null;
      }

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType?.includes("application/json")) {
        data = await res.json();
      } else {
        console.error("Expected JSON but got:", await res.text());
        // await logout();
        return null;
      }

      access = data.access;
      if (access) await SecureStore.setItemAsync("access", access);
    } catch (err) {
      console.error("Refresh token failed", err);
      // await logout();
      return null;
    }
  }

  return access;
}




// export async function getAccessToken(): Promise<string | null> {
//   let access = await SecureStore.getItemAsync("access");
//   const refresh = await SecureStore.getItemAsync("refresh");

//   if (isTokenExpired(access) && refresh) { // if (!access && refresh) {
//     // Try refreshing
//     const res = await fetch(endpoints.tokenRefresh, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ refresh }),
//     });

//     if (res.ok) {
//       const data = await res.json();
//       access = data.access;
//         if (access) {
//             await SecureStore.setItemAsync("access", access);
//         }
//         else {
//             console.log("oops")
//         }
//     } else {
//       await logout();
//     }
//   }
//   return access;
// }

// export async function logout() {
//   await SecureStore.deleteItemAsync("access");
//   await SecureStore.deleteItemAsync("refresh");

//     // setUser(null);

//     // await AlarmModule.clearLaunchIntent();

//     // // 3. Reset navigation to login screen
//     // navigation.reset({
//     //   index: 0,
//     //   routes: [{ name: "Login" }],
//     // });
// }



// function setUser(arg0: null) {
//   throw new Error("Function not implemented.");
// }
// import { getAccessToken } from "../../auth";

      // const accessToken = await getAccessToken();
      // if (!accessToken) {
      //   throw new Error("Not authenticated");
      // }

      // const res = await fetch(endpoints.createWordleGame, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     "Authorization": `Bearer ${accessToken}`,
      //   },
      //   body: JSON.stringify({ challenge_id: challengeId }),
      // });



      //         const res = await fetch(endpoints.skillLevels(), {
      //           headers: {
      //             Authorization: `Bearer ${accessToken}`
      //           }
      //         });
