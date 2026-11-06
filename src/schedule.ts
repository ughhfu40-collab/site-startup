export const HALF_HOUR = 30 * 60 * 1000;
export const BOOKING_WINDOW = 7 * 24 * 60 * 60 * 1000;
const OFFSET = 5 * 60 * 60 * 1000;
export function bookingTimeError(value: string, now = Date.now()): string | null {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Выбери дату и время';
  if (time <= now || time > now + BOOKING_WINDOW) return 'Выбери будущее время не дальше чем на 7 дней вперёд';
  if (time % HALF_HOUR !== 0) return 'Минуты могут быть только 00 или 30, без секунд';
  return null;
}
export function availableSlots(now = Date.now()) {
  const result: { iso: string; date: string; hour: string; minute: string }[] = [];
  for (let t = (Math.floor(now / HALF_HOUR) + 1) * HALF_HOUR; t <= now + BOOKING_WINDOW; t += HALF_HOUR) {
    const local = new Date(t + OFFSET).toISOString();
    result.push({ iso: new Date(t).toISOString(), date: local.slice(0, 10), hour: local.slice(11, 13), minute: local.slice(14, 16) });
  }
  return result;
}
