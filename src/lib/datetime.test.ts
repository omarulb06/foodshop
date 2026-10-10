import { dayKey, formatDayKeyShort, formatRelativeDateTime, lastDayKeys } from '@/lib/datetime';

describe('dayKey', () => {
  it('uses the device time zone so days match what the user sees', () => {
    expect(dayKey(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08');
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('lastDayKeys', () => {
  it('ends on the current day and runs oldest first', () => {
    expect(lastDayKeys(3, new Date(2026, 9, 8, 15))).toEqual([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
  });

  it('crosses month boundaries', () => {
    expect(lastDayKeys(2, new Date(2026, 9, 1, 15))).toEqual(['2026-09-30', '2026-10-01']);
  });
});

describe('formatDayKeyShort', () => {
  it('splits a day into a weekday and a date', () => {
    expect(formatDayKeyShort('2026-10-08')).toEqual({ weekday: 'ה׳', date: '8 באוק׳' });
  });
});

describe('formatRelativeDateTime', () => {
  const now = new Date(2026, 9, 8, 15);

  it('names today and yesterday', () => {
    expect(formatRelativeDateTime(new Date(2026, 9, 8, 9, 5), now)).toBe('היום בשעה 09:05');
    expect(formatRelativeDateTime(new Date(2026, 9, 7, 18, 40), now)).toBe('אתמול בשעה 18:40');
  });

  it('falls back to a full date further back', () => {
    expect(formatRelativeDateTime(new Date(2026, 9, 1, 8, 0), now)).toBe('1 באוק׳ 2026 בשעה 08:00');
  });
});
