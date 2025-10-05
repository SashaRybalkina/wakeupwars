import { BASE_URL } from "./api";
import { NativeModules } from 'react-native';
const { NotificationModule } = NativeModules;

class NotificationService {

  static async sendNotification(userId: number, title: string, body: string, screen: string, params: any) {
    try {
      // 1️⃣ Fetch CSRF token
      const tokenRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: "include", // include cookies
      });
      const tokenData = await tokenRes.json();
      const csrfToken = tokenData.csrfToken;

      // 2️⃣ Send notification with CSRF token in headers
      const res = await fetch(`${BASE_URL}/api/notifications/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken, // <-- add CSRF token here
        },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, title, body }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} ${text}`);
      }

      if (title != "Alarm") {
        NotificationModule.showNotification(title, body, screen, params)
      }

    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }
}

export default NotificationService;