import { BASE_URL } from "./api";
import { NativeModules } from 'react-native';
import { getAccessToken } from "./auth";
const { NotificationModule } = NativeModules;

class NotificationService {

  static async sendNotification(
    userId: number, 
    title: string, 
    body: string, 
    screen: string, 
    params?: { challengeId?: number; challName?: string; whichChall?: string }
  ) {
    try {
      const challengeId = params?.challengeId ?? null;
      const challName = params?.challName ?? null;
      const whichChall = params?.whichChall ?? null;

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${BASE_URL}/api/notifications/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          user_id: userId, 
          title, 
          body, 
          screen, 
          challengeId, 
          challName, 
          whichChall }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} ${text}`);
      }

      if (title != "Alarm") {
        NotificationModule.showNotification(title, body, screen, {
          screen,
          params: {
            challengeId,
            challName,
            whichChall,
          }
        });
      }

    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }
}

export default NotificationService;