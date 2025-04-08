import * as Notifications from 'expo-notifications';

// Request permission for notifications (necessary for iOS)
async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();

  // Handle the case where permission was not granted
  if (status !== 'granted') {
    throw new Error('Notification permission not granted!');
  }
  console.log('Notification permission granted!');
}

// Function to schedule a notification at a specific time
async function scheduleNotification(hour: number, minute: number) {
  const now = new Date();

  // Create a new Date object for the next scheduled time
  let notificationTime = new Date();
  notificationTime.setHours(hour, minute, 0, 0); // Set to the desired time

  // If the time has already passed today, schedule for tomorrow
  if (notificationTime <= now) {
    notificationTime.setDate(notificationTime.getDate() + 1); // Schedule for tomorrow
  }

  // Calculate the delay in milliseconds until the next notification time
  const delay = notificationTime.getTime() - now.getTime();

  // Schedule the notification using setTimeout
  setTimeout(async () => {
    // First notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Alarm!',
        body: 'This is your scheduled alarm notification!',
        sound: 'default',
      },
      trigger: null, // No trigger needed, we'll use setTimeout
    });

    console.log(
      `First alarm triggered at: ${notificationTime.toLocaleTimeString()}`,
    );

    // Schedule the notification to repeat every 24 hours
    setInterval(
      async () => {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Alarm!',
            body: 'This is your scheduled alarm notification!',
            sound: 'default',
          },
          trigger: null, // No trigger needed
        });

        console.log('Repeating alarm triggered!');
      },
      24 * 60 * 60 * 1000,
    ); // Repeats every 24 hours
  }, delay); // Delay the first notification

  console.log(
    `First alarm scheduled for: ${notificationTime.toLocaleTimeString()}`,
  );
}

// Request permission and schedule the alarm
requestPermissions()
  .then(() => scheduleNotification(2, 35)) // Example for 2:33 AM
  .catch((error) => console.error(error.message)); // Handle the error case
