import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketDataStore } from "../src/store.ts";
import { DEFAULT_UNIVERSE_FILTER } from "../src/universe.ts";
import { asset, bar, day } from "./helpers.ts";

function store(): MarketDataStore {
  return new MarketDataStore(
    [
      bar("AAPL", day(1), 10, 100),
      bar("AAPL", day(2), 11, 100),
      bar("AAPL", day(3), 12, 100),
      bar("MSFT", day(1), 20, 100),
      bar("TSLA", day(1), 30, 100),
      bar("ILLIQUID", day(1), 1, 1),
    ],
    [
      asset("AAPL"),
      asset("MSFT", { delistedAt: day(2) }),
      asset("TSLA", { listedAt: day(1) }),
      asset("ILLIQUID"),
      asset("NODATA"),
      asset("FUTURE", { listedAt: day(5) }),
    ],
  );
}

test("excludes assets that are not listed or are delisted", () => {
  const snapshot = store().universe(day(3));
  assert.deepEqual(snapshot.symbols, ["AAPL", "ILLIQUID", "TSLA"]);
  assert.deepEqual(snapshot.excluded, [
    { symbol: "FUTURE", reason: "not_listed" },
    { symbol: "MSFT", reason: "delisted" },
    { symbol: "NODATA", reason: "no_data" },
  ]);
});

test("applies history and liquidity filters", () => {
  const snapshot = store().universe(day(3), {
    lookbackDays: 365,
    minHistoryBars: 3,
    minAverageDollarVolume: 500,
  });
  assert.deepEqual(snapshot.symbols, ["AAPL"]);
  assert.deepEqual(snapshot.excluded, [
    { symbol: "FUTURE", reason: "not_listed" },
    { symbol: "ILLIQUID", reason: "insufficient_history" },
    { symbol: "MSFT", reason: "delisted" },
    { symbol: "NODATA", reason: "no_data" },
    { symbol: "TSLA", reason: "insufficient_history" },
  ]);
});

test("applies the lookback window", () => {
  const snapshot = store().universe(day(3), {
    ...DEFAULT_UNIVERSE_FILTER,
    lookbackDays: 1,
  });
  assert.deepEqual(snapshot.symbols, ["AAPL"]);
  assert.ok(
    snapshot.excluded.some(
      (entry) => entry.symbol === "TSLA" && entry.reason === "no_data",
    ),
  );
});