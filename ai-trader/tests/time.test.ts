import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketDataError } from "../src/errors.ts";
import { formatTimestamp, parseTimestamp } from "../src/time.ts";

test("parses date-only values as UTC midnight", () => {
  assert.equal(parseTimestamp("2024-02-29"), Date.UTC(2024, 1, 29));
  assert.equal(
    formatTimestamp(parseTimestamp("2024-02-29")),
    "2024-02-29T00:00:00.000Z",
  );
});

test("parses timezone offsets", () => {
  assert.equal(
    parseTimestamp("2024-01-01T12:00:00+02:00"),
    Date.UTC(2024, 0, 1, 10),
  );
  assert.equal(
    parseTimestamp("2024-01-01T12:00:00-05:30"),
    Date.UTC(2024, 0, 1, 17, 30),
  );
  assert.equal(
    parseTimestamp("2024-01-01T12:00:00Z"),
    Date.UTC(2024, 0, 1, 12),
  );
});

test("truncates fractional seconds to milliseconds", () => {
  assert.equal(
    parseTimestamp("2024-01-01T00:00:00.123456Z"),
    Date.UTC(2024, 0, 1, 0, 0, 0, 123),
  );
});

test("rejects invalid calendar dates", () => {
  assert.throws(() => parseTimestamp("2023-02-29"), MarketDataError);
  assert.throws(() => parseTimestamp("2024-13-01"), MarketDataError);
  assert.throws(() => parseTimestamp("2024-04-31"), MarketDataError);
});

test("requires a timezone for intraday values", () => {
  assert.throws(
    () => parseTimestamp("2024-01-01T12:00:00"),
    /timezone/,
  );
});

test("rejects malformed values", () => {
  assert.throws(() => parseTimestamp("01/02/2024"), MarketDataError);
  assert.throws(() => parseTimestamp("2024-01-01T25:00:00Z"), MarketDataError);
});