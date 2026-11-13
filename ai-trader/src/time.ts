import { MarketDataError } from "./errors.ts";

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month === 2) {
    return leap ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

function parseOffset(text: string, field: string, line: number | undefined): number {
  if (text === "Z") {
    return 0;
  }
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(text);
  if (match === null) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Invalid timezone offset: ${text}`,
      { field, line },
    );
  }
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Timezone offset is out of range: ${text}`,
      { field, line },
    );
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (hours * 60 + minutes);
}

export function parseTimestamp(
  value: string,
  field = "timestamp",
  line?: number,
): number {
  const text = value.trim();
  const match = TIMESTAMP_PATTERN.exec(text);
  if (match === null) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Invalid ISO 8601 timestamp: ${value}`,
      { field, line },
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hasTime = match[4] !== undefined;

  if (month < 1 || month > 12) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Invalid month in timestamp: ${value}`,
      { field, line },
    );
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Invalid day in timestamp: ${value}`,
      { field, line },
    );
  }

  const hour = hasTime ? Number(match[4]) : 0;
  const minute = hasTime ? Number(match[5]) : 0;
  const second = hasTime ? Number(match[6] ?? "0") : 0;
  if (hour > 23 || minute > 59 || second > 59) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Invalid time in timestamp: ${value}`,
      { field, line },
    );
  }
  if (hasTime && match[8] === undefined) {
    throw new MarketDataError(
      "invalid_timestamp",
      `Timestamp must include a timezone: ${value}`,
      { field, line },
    );
  }

  const offset = hasTime ? parseOffset(match[8]!, field, line) : 0;
  const fraction = match[7] ?? "";
  const millisecond = Number(fraction.padEnd(3, "0").slice(0, 3));
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime() - offset * 60_000;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}