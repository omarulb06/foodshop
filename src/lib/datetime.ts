const MONTHS = [
  'ינו׳',
  'פבר׳',
  'מרץ',
  'אפר׳',
  'מאי',
  'יוני',
  'יולי',
  'אוג׳',
  'ספט׳',
  'אוק׳',
  'נוב׳',
  'דצמ׳',
];

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `YYYY-MM-DD` in the device's own time zone, so days match what the user sees. */
export function dayKey(value: string | Date): string {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(value: string | Date): Date {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Oldest first, ending with the day that `now` falls in. */
export function lastDayKeys(days: number, now: string | Date = new Date()): string[] {
  const end = startOfDay(now);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - offset);
    keys.push(dayKey(day));
  }
  return keys;
}

function fromDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string | Date): string {
  const date = toDate(value);
  return `${date.getDate()} ב${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTime(value: string | Date): string {
  const date = toDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} בשעה ${formatTime(value)}`;
}

/** Short two line friendly label used under chart bars, for example "Thu" / "1 Oct". */
export function formatDayKeyShort(key: string): { weekday: string; date: string } {
  const date = fromDayKey(key);
  return {
    weekday: WEEKDAYS[date.getDay()],
    date: `${date.getDate()} ב${MONTHS[date.getMonth()]}`,
  };
}

export function formatDayKey(key: string): string {
  return formatDate(fromDayKey(key));
}

export function monthKey(value: string | Date): string {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Oldest first, ending with the month that `now` falls in. */
export function lastMonthKeys(months: number, now: string | Date = new Date()): string[] {
  const end = toDate(now);
  const keys: string[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const month = new Date(end.getFullYear(), end.getMonth() - offset, 1);
    keys.push(monthKey(month));
  }
  return keys;
}

/** Day keys render as "8 באוק׳". Month keys render as "אוק׳ 2026". */
export function formatBucketLabel(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  }
  return formatDayKeyShort(key).date;
}

export function isToday(value: string | Date, now: string | Date = new Date()): boolean {
  return dayKey(value) === dayKey(now);
}

/** "היום בשעה 14:05", "אתמול בשעה 09:12" or "28 באוק׳ 2026 בשעה 09:12". */
export function formatRelativeDateTime(value: string | Date, now: string | Date = new Date()): string {
  const key = dayKey(value);
  const today = startOfDay(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  if (key === dayKey(today)) {
    return `היום בשעה ${formatTime(value)}`;
  }
  if (key === dayKey(yesterday)) {
    return `אתמול בשעה ${formatTime(value)}`;
  }
  return formatDateTime(value);
}
