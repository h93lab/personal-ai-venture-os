export function assertValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    throw new Error("Invalid IANA timezone");
  }
}

function offsetMinutesAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function localTimeToUtcCron(hour: number, minute: number, timeZone: string, now = new Date()) {
  assertValidTimeZone(timeZone);
  const offset = offsetMinutesAt(now, timeZone);
  const utcMinutes = ((hour * 60 + minute - offset) % 1440 + 1440) % 1440;
  const utcHour = Math.floor(utcMinutes / 60);
  const utcMinute = utcMinutes % 60;
  return `0 ${utcMinute} ${utcHour} * * *`;
}
