import * as Notifications from "expo-notifications";
import { BASE_URL } from "./api";

class NotificationService {
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification!");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  }

  static async triggerNotification(title: string, body: string, screenName: string) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        data: { screen: screenName },
      },
      trigger: null
    });

    console.log('Instant notification sent!');
  }

  static async sendNotification(userId: number, title: string, body: string, screenName: string) {
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

      await this.triggerNotification(title, body, screenName);
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }
}

export default NotificationService;