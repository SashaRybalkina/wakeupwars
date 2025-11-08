import { scheduleAlarms } from './Alarm';
import { endpoints } from './api';
import { getAccessToken } from './auth';

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
          const accessToken = await getAccessToken();
          if (!accessToken) {
            throw new Error("Not authenticated");
          }
          
    const res = await fetch(endpoints.getChallengeSchedule(challId), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      console.warn('Could not fetch challenge schedule', res.status);
      return;
    }

    const data = await res.json();
    const { startDate, endDate, schedule } = data as {
      startDate: string; // "YYYY-MM-DD"
      endDate: string;   // "YYYY-MM-DD"
      schedule: any[];
    };

    if (!schedule || !Array.isArray(schedule)) {
      console.warn('Unexpected schedule shape', schedule);
      return;
    }

    // Parse YYYY-MM-DD as a LOCAL date to avoid UTC shifting a day earlier/later
    const parseLocalYMD = (ymd: string): Date => {
      const [yRaw, mRaw, dRaw] = ymd.split('-');
      const y = Number.parseInt(yRaw ?? '', 10) || 1970;
      const m = Number.parseInt(mRaw ?? '', 10) || 1;   // 1-12
      const d = Number.parseInt(dRaw ?? '', 10) || 1;   // 1-31
      return new Date(y, m - 1, d);
    };

    const alarms = buildAlarmList(
      parseLocalYMD(startDate),
      parseLocalYMD(endDate),
      schedule,
      challId,
      challName,
      whichChall,
    );

    if (alarms.length === 0) return;

    console.log(alarms)
    await scheduleAlarms(alarms);
  } catch (err) {
    console.error('Failed to sync alarms:', err);
  }
}

export async function scheduleAlarmsForUser(
  challId: number,
  challName: string,
  userId: number,
  whichChall: string = '',
): Promise<void> {
  try {
    const access = await getAccessToken();
    if (!access) {
      throw new Error("Not authenticated");
    }
    const res = await fetch(endpoints.getChallengeUserSchedule(challId, userId), {
      headers: {
        Authorization: `Bearer ${access}`
      }
    });

    if (!res.ok) {
      console.warn('Could not fetch challenge schedule', res.status);
      return;
    }

    const data = await res.json();
    console.log(data)
    const { startDate, endDate, schedule } = data as {
      startDate: string; // "YYYY-MM-DD"
      endDate: string;   // "YYYY-MM-DD"
      schedule: any[];
    };

    if (!schedule || !Array.isArray(schedule)) {
      console.warn('Unexpected schedule shape', schedule);
      return;
    }

    // Parse YYYY-MM-DD as a LOCAL date to avoid UTC shifting a day earlier/later
    const parseLocalYMD = (ymd: string): Date => {
      const [yRaw, mRaw, dRaw] = ymd.split('-');
      const y = Number.parseInt(yRaw ?? '', 10) || 1970;
      const m = Number.parseInt(mRaw ?? '', 10) || 1;   // 1-12
      const d = Number.parseInt(dRaw ?? '', 10) || 1;   // 1-31
      return new Date(y, m - 1, d);
    };

    const alarms = buildAlarmList(
      parseLocalYMD(startDate),
      parseLocalYMD(endDate),
      schedule,
      challId,
      challName,
      whichChall,
    );

    if (alarms.length === 0) return;

    // console.log(alarms)
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

  // Helper: map a game name to a route name and whichChall value
  const mapGameToRoute = (gameName?: string): { screen: string; whichChall: string } => {
    const n = (gameName || '').toLowerCase();
    if (n.includes('sudoku')) return { screen: 'Sudoku', whichChall: 'sudoku' };
    if (n.includes('wordle')) return { screen: 'Wordle', whichChall: 'wordle' };
    if (n.includes('pattern')) return { screen: 'PatternGame', whichChall: 'pattern' };
    return { screen: 'ChallDetails', whichChall: '' };
  };

  const whichFromScreen = (screen?: string): string => {
    const s = (screen || '').toLowerCase();
    if (s.includes('sudoku')) return 'sudoku';
    if (s.includes('wordle')) return 'wordle';
    if (s.includes('pattern')) return 'pattern';
    return '';
  };

  // Iterate through each day definition coming from the backend.
  for (const day of schedule) {
    const dayOfWeek: number = day.dayOfWeek; // 1 = Monday … 7 = Sunday (ISO-8601)

    const [hoursStr, minutesStr] = day.alarmTime.split(':');
    const hours = parseInt(hoursStr ?? '0', 10);
    const minutes = parseInt(minutesStr ?? '0', 10);

    // Choose the first game by order (if any) for this day
    const gamesForDay: { id?: number; name: string; order?: number; screen?: string }[] = Array.isArray(day.games) ? day.games : [];
    const sorted = [...gamesForDay].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const primary = sorted[0];
    const primaryGame = primary?.name;
    const primaryScreen = primary?.screen; // provided by backend when available
    const route = mapGameToRoute(primaryGame);

    // Walk through the calendar range and pick the days that match.
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const jsDay = d.getDay(); // 0 (Sun) – 6 (Sat)
      const isoDay = jsDay === 0 ? 7 : jsDay; // convert to 1-7 ISO
      if (isoDay !== dayOfWeek) continue;

      const alarmDate = new Date(d);
      alarmDate.setHours(hours, minutes, 0, 0);

      // Only schedule alarms in the future.
      if (alarmDate.getTime() > Date.now()) {
        const screenToUse = primaryScreen || route.screen;
        // TODO: add something to this about the user?
        console.log(alarmDate + " " + screenToUse)
        alarms.push({
          time: alarmDate,
          screen: screenToUse,
          data: {
            challengeId: challId,
            challName,
            whichChall: whichChall || whichFromScreen(screenToUse) || route.whichChall,
            gameName: primaryGame ?? '',
            gameId: primary?.id ?? undefined,
          },
        });
      }
    }
  }

  return alarms;
}

// kept for backward compatibility in case other callers use it; not used above
function guessScreen(challName: string): string {
  const lower = challName.toLowerCase();
  if (lower.includes('sudoku')) return 'Sudoku';
  if (lower.includes('wordle')) return 'Wordle';
  if (lower.includes('pattern')) return 'PatternGame';
  return 'ChallDetails';
}
