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
  // If the native module is not available (e.g. running in Expo Go / web), bail out
  if (!AlarmModule || typeof AlarmModule.setAlarm !== 'function') {
    console.warn('[Alarm] Native AlarmModule not found – skipping alarm scheduling. Available modules:', Object.keys(NativeModules));
    return;
  }

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
      await AlarmModule.setAlarm(timestamp, alarm.screen, alarm.data);
    } catch (err: any) {
      Alert.alert('Alarm Error', err.message || String(err));
    }
  }
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
      console.log('NativeModules keys:', Object.keys(NativeModules));
      // Optionally, handle success (e.g., log or show a toast)
      // Alert.alert('Alarm Set', msg);
    } catch (err: any) {
      Alert.alert('Alarm Error', err.message || String(err));
    }
  }
}

// Example usage removed; alarms now come from backend schedule via alarmService.
