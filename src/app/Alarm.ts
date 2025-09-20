// Alarm.ts
import { Alert, NativeModules } from 'react-native';

const { AlarmModule } = NativeModules;

/**
 * Schedules one or more alarms using the native AlarmModule.
 * @param alarms Array of objects: { time: Date | string, screen: string, data: object }
 */
export async function scheduleAlarms(
  alarms: { time: Date | string; screen: string; data: object }[],
) {
  for (const alarm of alarms) {
    let timestamp: number;
    if (alarm.time instanceof Date) {
      timestamp = alarm.time.getTime();
    } else if (typeof alarm.time === 'string') {
      timestamp = new Date(alarm.time).getTime();
    } else {
      Alert.alert('Alarm Error', 'Invalid time format');
      continue;
    }
    try {
      const msg = await AlarmModule.setAlarm(
        timestamp,
        alarm.screen,
        alarm.data,
      );
      // Optionally, handle success (e.g., log or show a toast)
      // Alert.alert('Alarm Set', msg);
    } catch (err: any) {
      Alert.alert('Alarm Error', err.message || String(err));
    }
  }
}

// Example usage (remove or comment out in production):
// scheduleAlarms([
//   {
//     time: new Date('2024-06-10T08:30:00'),
//     screen: 'Wordle',
//     data: { challengeId: 30, challName: 'Test Challenge', whichChall: 'wordle' },
//   },
//   {
//     time: '2024-06-10T09:00:00',
//     screen: 'Sudoku',
//     data: { challengeId: 31, challName: 'Sudoku Challenge', whichChall: 'sudoku' },
//   },
// ]);
