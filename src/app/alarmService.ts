import { scheduleAlarms } from './Alarm';
import { endpoints } from './api';

/**
 * Fetch the backend schedule for a challenge and schedule native alarms for the
 * current device.
 *
 * Because the backend only stores day-of-week + time strings, this helper
 * expands the schedule into concrete Date objects between the challenge's
 * start and end dates (inclusive) and passes them to `scheduleAlarms`.
 */
export async function scheduleAlarmsForChallenge(
  challId: number,
  challName: string,
  whichChall: string = '',
): Promise<void> {
  try {
    const res = await fetch(endpoints.getChallengeSchedule(challId), {
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn('Could not fetch challenge schedule', res.status);
      return;
    }

    const data = await res.json();
    const { startDate, endDate, schedule } = data as {
      startDate: string;
      endDate: string;
      schedule: any[];
    };

    if (!schedule || !Array.isArray(schedule)) {
      console.warn('Unexpected schedule shape', schedule);
      return;
    }

    const alarms = buildAlarmList(
      new Date(startDate),
      new Date(endDate),
      schedule,
      challId,
      challName,
      whichChall,
    );

    if (alarms.length === 0) return;

    await scheduleAlarms(alarms);
  } catch (err) {
    console.error('Failed to sync alarms:', err);
  }
}

/**
 * Convert the backend challenge schedule into the format required by
 * `scheduleAlarms`.
 */
function buildAlarmList(
  start: Date,
  end: Date,
  schedule: any[],
  challId: number,
  challName: string,
  whichChall: string,
) {
  type AlarmInput = {
    time: Date;
    screen: string;
    data: Record<string, unknown>;
  };

  const alarms: AlarmInput[] = [];

  // Iterate through each day definition coming from the backend.
  for (const day of schedule) {
    const dayOfWeek: number = day.dayOfWeek; // 1 = Monday … 7 = Sunday (ISO-8601)

    // Each alarm row has a `alarmTime` such as "07:30" and the user it belongs
    // to. We schedule *all* returned alarms because the backend is already
    // scoped to the current user.
    for (const alarm of day.alarms as { alarmTime: string }[]) {
      const [hoursStr, minutesStr] = alarm.alarmTime.split(':');
      const hours = parseInt(hoursStr ?? '0', 10);
      const minutes = parseInt(minutesStr ?? '0', 10);

      // Walk through the calendar range and pick the days that match.
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay(); // 0 (Sun) – 6 (Sat)
        const isoDay = jsDay === 0 ? 7 : jsDay; // convert to 1-7 ISO
        if (isoDay !== dayOfWeek) continue;

        const alarmDate = new Date(d);
        alarmDate.setHours(hours, minutes, 0, 0);

        // Only schedule alarms in the future.
        if (alarmDate.getTime() > Date.now()) {
          alarms.push({
            time: alarmDate,
            screen: guessScreen(challName),
            data: { challengeId: challId, challName, whichChall },
          });
        }
      }
    }
  }

  return alarms;
}

function guessScreen(challName: string): string {
  const lower = challName.toLowerCase();
  if (lower.includes('sudoku')) return 'Sudoku';
  if (lower.includes('wordle')) return 'Wordle';
  if (lower.includes('pattern')) return 'PatternGame';
  return 'ChallDetails';
}
