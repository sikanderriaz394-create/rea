import assert from "node:assert/strict";
import { test } from "node:test";
import type { Bar } from "../src/domain.ts";
import { MarketDataError } from "../src/errors.ts";
import {
  validateActions,
  validateAssets,
  validateBars,
} from "../src/validate.ts";
import { asset, bar, day, dividend, split } from "./helpers.ts";

test("accepts well-formed bars", () => {
  validateBars([
    bar("AAPL", day(1), 10),
    bar("AAPL", day(2), 11),
    bar("MSFT", day(1), 20),
  ]);
});

test("rejects invalid OHLC relationships", () => {
  assert.throws(
    () =>
      validateBars([
        { ...bar("AAPL", day(1), 10), high: 9, low: 8 },
      ]),
    MarketDataError,
  );
  assert.throws(
    () =>
      validateBars([
        { ...bar("AAPL", day(1), 10), high: 9, low: 8, open: 10 },
      ]),
    MarketDataError,
  );
  assert.throws(
    () =>
      validateBars([
        { ...bar("AAPL", day(1), 10), low: 11, high: 12 },
      ]),
    MarketDataError,
  );
});

test("rejects duplicate and unsorted bars", () => {
  assert.throws(
    () => validateBars([bar("AAPL", day(1), 10), bar("AAPL", day(1), 11)]),
    MarketDataError,
  );
  assert.throws(
    () => validateBars([bar("AAPL", day(2), 10), bar("AAPL", day(1), 11)]),
    MarketDataError,
  );
});

test("rejects invalid symbols, timestamps, volumes, and adjusted flags", () => {
  assert.throws(
    () => validateBars([{ ...bar("bad symbol", day(1), 10) }]),
    MarketDataError,
  );
  assert.throws(
    () => validateBars([{ ...bar("AAPL", 1.5, 10) }]),
    MarketDataError,
  );
  assert.throws(
    () => validateBars([{ ...bar("AAPL", day(1), 10, -1) }]),
    MarketDataError,
  );
  const invalid = { ...bar("AAPL", day(1), 10), adjusted: "yes" };
  assert.throws(
    () => validateBars([invalid as unknown as Bar]),
    MarketDataError,
  );
});

test("validates assets and rejects duplicates and invalid dates", () => {
  validateAssets([asset("AAPL"), asset("BTC/USD", { assetClass: "crypto" })]);
  assert.throws(
    () => validateAssets([asset("AAPL"), asset("AAPL")]),
    MarketDataError,
  );
  assert.throws(
    () =>
      validateAssets([
        asset("AAPL", {
          listedAt: day(2),
          delistedAt: day(1),
        }),
      ]),
    MarketDataError,
  );
});

test("validates actions and rejects duplicates and invalid values", () => {
  validateActions([
    split("AAPL", day(2), 2),
    dividend("AAPL", day(2), 0.25),
  ]);
  assert.throws(
    () =>
      validateActions([split("AAPL", day(2), 2), split("AAPL", day(2), 3)]),
    MarketDataError,
  );
  assert.throws(
    () => validateActions([split("AAPL", day(2), 0)]),
    MarketDataError,
  );
  assert.throws(
    () => validateActions([dividend("AAPL", day(2), -1)]),
    MarketDataError,
  );
});