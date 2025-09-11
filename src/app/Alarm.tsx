import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class Alarm {
  // Request permissions (mainly for iOS)
  static async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Notification permission not granted!');
    }
    console.log('✅ Notification permission granted!');
  }

  // Setup Android notification channel
  static async setupAndroidChannel() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  static async scheduleBurstNotification(
    screenName: string,
    hour: number,
    minute: number,
    durationInSeconds: number,
    params: Record<string, any> = {}
  ) {
    try {
      await Alarm.requestPermissions();
      await Alarm.setupAndroidChannel();
  
      const now = new Date();
  
      // Create target time (today at hour:minute)
      let startTime = new Date();
      startTime.setHours(hour, minute, 0, 0);
  
      // If that time is in the past today, schedule for tomorrow
      if (startTime <= now) {
        startTime.setDate(startTime.getDate() + 1);
      }
  
      // Schedule notifications every second after startTime
      for (let i = 0; i < durationInSeconds; i++) {
        const fireDate = new Date(startTime.getTime() + i * 1000);
  
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Alarm!',
            body: 'Tap to stop the alarm!',
            sound: 'default',
            data: {
              screen: screenName,
              params,
            },
          },
          trigger: fireDate
        });
      }
  
      console.log(
        `✅ Burst notifications scheduled for ${durationInSeconds} seconds starting at ${hour}:${minute
          .toString()
          .padStart(2, '0')}`,
      );
    } catch (error) {
      console.error('❌ Burst alarm setup failed:', error);
    }
  }  

  // Cancel all scheduled notifications
  static async stopAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🛑 All scheduled notifications canceled');
  }
}