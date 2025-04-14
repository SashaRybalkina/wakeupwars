import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot, SplashScreen } from 'expo-router';
import { UserProvider } from './context/UserContext';

import { AppProvider } from '../providers/AppProvider';
import { Alarm } from './Alarm'; // Import the Alarm class

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Simulate fetching alarm data from a "database"
  const fetchDummyAlarms = async () => {
    return [
      {
        hour: 3,
        minute: 15,
        screen: 'SudokuScreen',
        params: { puzzleId: 42 },
      },
      {
        hour: 7,
        minute: 45,
        screen: 'MeditationScreen',
        params: { session: 'morning' },
      },
    ];
  };

  useEffect(() => {
    const setupAlarms = async () => {
      const alarmList = await fetchDummyAlarms();

      try {
        // Request notification permission once for all alarms
        await Alarm.requestPermissions();

        // Optionally: clear existing scheduled notifications to avoid duplicates
        // await Notifications.cancelAllScheduledNotificationsAsync();

        // Schedule each alarm from the fetched list
        for (const alarm of alarmList) {
          await Alarm.scheduleNotification(
            alarm.screen,
            alarm.hour,
            alarm.minute,
          );
        }
      } catch (err) {
        console.error('Alarm setup failed:');
      }
    };

    // Run on first load
    setupAlarms();

    // Reschedule on app resume
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setupAlarms(); // Reschedule alarms when app comes to the foreground
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <AppProvider onInitialized={() => SplashScreen.hideAsync()}>
      <UserProvider>
        <Slot />
      </UserProvider>
    </AppProvider>
  );
}
