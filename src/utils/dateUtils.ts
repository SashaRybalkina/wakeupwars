
export const getNextAlarmDate = (
    alarmSchedule: { dayOfWeek: number; time: string }[],
): Date | null => {
    if (!alarmSchedule.length) return null;

    const now = new Date();

    for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);

    const weekday = candidate.getDay() === 0 ? 7 : candidate.getDay(); // Sun = 7
    const todays = alarmSchedule.filter(a => a.dayOfWeek === weekday);
    if (!todays.length) continue;

    if (
        offset === 0 && // checking today
        !todays.some(a => {
        const [hhStr, mmStr] = a.time.split(':');
        const hh = Number(hhStr ?? '0');
        const mm = Number(mmStr ?? '0');
        if (Number.isNaN(hh) || Number.isNaN(mm)) {
            return false;
        }
        const alarmTime = new Date(candidate);
        alarmTime.setHours(hh, mm, 0, 0);
        return alarmTime > now; // strictly future; “now” counts as future enough
        })
    ) {
        continue; // all of today’s alarms are already past
    }

    return candidate;
    }

    return null;
};