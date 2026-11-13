import assert from "node:assert/strict";
import { test } from "node:test";
import { adjustBars } from "../src/adjust.ts";
import { MarketDataError } from "../src/errors.ts";
import { bar, day, dividend, split } from "./helpers.ts";

function closeTo(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${actual} is not close to ${expected}`,
  );
}

test("adjusts historical prices and volume for splits", () => {
  const adjusted = adjustBars(
    [bar("AAPL", day(1), 10, 100), bar("AAPL", day(2), 20, 100)],
    [split("AAPL", day(2), 2)],
  );
  closeTo(adjusted[0]!.close, 5);
  assert.equal(adjusted[0]!.volume, 200);
  closeTo(adjusted[1]!.close, 20);
  assert.equal(adjusted[1]!.volume, 100);
  assert.equal(adjusted[0]!.adjusted, true);
});

test("adjusts historical prices for cash dividends", () => {
  const adjusted = adjustBars(
    [bar("AAPL", day(1), 10), bar("AAPL", day(2), 10)],
    [dividend("AAPL", day(2), 1)],
  );
  closeTo(adjusted[0]!.close, 9);
  closeTo(adjusted[1]!.close, 10);
});

test("composes split and dividend factors", () => {
  const adjusted = adjustBars(
    [bar("AAPL", day(1), 10, 100), bar("AAPL", day(2), 10, 100), bar("AAPL", day(3), 10, 100)],
    [dividend("AAPL", day(2), 1), split("AAPL", day(3), 2)],
  );
  closeTo(adjusted[0]!.close, 4.5);
  assert.equal(adjusted[0]!.volume, 200);
  closeTo(adjusted[1]!.close, 5);
  closeTo(adjusted[2]!.close, 10);
});

test("does not apply actions after asOf", () => {
  const adjusted = adjustBars(
    [bar("AAPL", day(1), 10)],
    [split("AAPL", day(2), 2)],
    day(1),
  );
  closeTo(adjusted[0]!.close, 10);
});

test("rejects bars after asOf", () => {
  assert.throws(
    () =>
      adjustBars(
        [bar("AAPL", day(2), 10)],
        [split("AAPL", day(1), 2)],
        day(1),
      ),
    MarketDataError,
  );
});

test("rejects missing ex-date bars and dividends at or above the ex-date close", () => {
  assert.throws(
    () =>
      adjustBars(
        [bar("AAPL", day(1), 10)],
        [dividend("AAPL", day(2), 1)],
      ),
    MarketDataError,
  );
  assert.throws(
    () =>
      adjustBars(
        [bar("AAPL", day(1), 10), bar("AAPL", day(2), 10)],
        [dividend("AAPL", day(2), 10)],
      ),
    MarketDataError,
  );
});