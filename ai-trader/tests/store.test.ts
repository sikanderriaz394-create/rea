import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketDataError } from "../src/errors.ts";
import { MarketDataStore } from "../src/store.ts";
import { asset, bar, day, split } from "./helpers.ts";

test("returns point-in-time bars and the latest bar", () => {
  const store = new MarketDataStore([
    bar("AAPL", day(1), 10),
    bar("AAPL", day(2), 11),
    bar("MSFT", day(1), 20),
  ]);

  assert.deepEqual(
    store.barsThrough("AAPL", day(2)).map((entry) => entry.timestamp),
    [day(1), day(2)],
  );
  assert.equal(store.latestBar("AAPL", day(2))?.close, 11);
  assert.equal(store.latestBar("AAPL", day(0)), undefined);
  assert.equal(store.barAt("AAPL", day(2))?.close, 11);
  assert.equal(store.barAt("AAPL", day(3)), undefined);
});

test("returns adjusted bars only for actions known at asOf", () => {
  const store = new MarketDataStore(
    [bar("AAPL", day(1), 10), bar("AAPL", day(2), 20)],
    [],
    [split("AAPL", day(2), 2)],
  );

  const throughDayOne = store.barsThrough("AAPL", day(1), {
    adjusted: true,
  });
  assert.equal(throughDayOne[0]?.close, 10);

  const throughDayTwo = store.barsThrough("AAPL", day(2), {
    adjusted: true,
  });
  assert.equal(throughDayTwo[0]?.close, 5);
  assert.equal(throughDayTwo[1]?.close, 20);
});

test("exposes symbols, assets, and the global timestamp range", () => {
  const store = new MarketDataStore(
    [bar("MSFT", day(2), 20), bar("AAPL", day(1), 10)],
    [asset("AAPL"), asset("MSFT")],
  );

  assert.deepEqual(store.symbols(), ["AAPL", "MSFT"]);
  assert.equal(store.asset("AAPL")?.name, "AAPL");
  assert.equal(store.assets().length, 2);
  assert.equal(store.firstTimestamp, day(1));
  assert.equal(store.lastTimestamp, day(2));
});

test("handles an empty store", () => {
  const store = new MarketDataStore([]);
  assert.deepEqual(store.symbols(), []);
  assert.equal(store.firstTimestamp, null);
  assert.equal(store.lastTimestamp, null);
  assert.deepEqual(store.barsThrough("AAPL", day(1)), []);
});

test("rejects duplicate and unsorted bars", () => {
  assert.throws(
    () =>
      new MarketDataStore([
        bar("AAPL", day(1), 10),
        bar("AAPL", day(1), 11),
      ]),
    MarketDataError,
  );
  assert.throws(
    () =>
      new MarketDataStore([
        bar("AAPL", day(2), 10),
        bar("AAPL", day(1), 11),
      ]),
    MarketDataError,
  );
});