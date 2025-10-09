import { getNextAlarmDate } from '../utils/dateUtils';

describe('getNextAlarmDate', () => {
  beforeAll(() => {
    jest.useFakeTimers(); // freeze time
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns next weeks same weekday if todays time already passed', () => {
    // Set current time: Wed Oct 1 2025 14:30
    jest.setSystemTime(new Date('2025-10-01T14:30:00'));

    const schedule = [{ dayOfWeek: 3, time: '14:28' }]; // Wednesday 2:28pm
    const result = getNextAlarmDate(schedule);

    // Should return next Wednesday: Oct 8, 2025
    expect(result).not.toBeNull();
    expect(result!.toISOString().substring(0, 10)).toBe('2025-10-08');
  });

  it('returns today if the alarm time is still in the future', () => {
    jest.setSystemTime(new Date('2025-10-01T14:30:00'));
    const schedule = [{ dayOfWeek: 3, time: '14:45' }];
    const result = getNextAlarmDate(schedule);

    // Same day (Oct 1)
    expect(result!.toISOString().substring(0, 10)).toBe('2025-10-01');
  });

  it('returns the next available day if today has no alarm', () => {
    jest.setSystemTime(new Date('2025-10-01T14:30:00')); // Wednesday
    const schedule = [{ dayOfWeek: 4, time: '09:00' }]; // Thursday 9:00am
    const result = getNextAlarmDate(schedule);

    expect(result!.toISOString().substring(0, 10)).toBe('2025-10-02');
  });

  it('returns null if schedule is empty', () => {
    jest.setSystemTime(new Date('2025-10-01T14:30:00'));
    const result = getNextAlarmDate([]);
    expect(result).toBeNull();
  });
});
