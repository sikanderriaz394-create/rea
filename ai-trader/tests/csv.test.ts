import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseActionsCsv,
  parseBarsCsv,
  parseCsv,
  parseUniverseCsv,
} from "../src/csv.ts";
import { MarketDataError } from "../src/errors.ts";

test("parses simple CSV rows", () => {
  const table = parseCsv(
    "symbol,timestamp,open,high,low,close,volume\r\nAAPL,2024-01-02,1,2,0.5,1.5,100\r\n",
  );
  assert.deepEqual(table.header, [
    "symbol",
    "timestamp",
    "open",
    "high",
    "low",
    "close",
    "volume",
  ]);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0]?.values[0], "AAPL");
  assert.equal(table.rows[0]?.line, 2);
});

test("handles BOM, quoted commas, escaped quotes, and quoted newlines", () => {
  const table = parseCsv(
    '\ufeffa,b\n"x,y","line\nbreak""quote"\n',
  );
  assert.deepEqual(table.header, ["a", "b"]);
  assert.deepEqual(table.rows[0]?.values, ["x,y", 'line\nbreak"quote']);
});

test("rejects duplicate and empty headers", () => {
  assert.throws(() => parseCsv("a,a\n1,2\n"), MarketDataError);
  assert.throws(() => parseCsv("a,\n1,2\n"), MarketDataError);
});

test("rejects rows with the wrong width", () => {
  assert.throws(() => parseCsv("a,b\n1\n"), MarketDataError);
  assert.throws(() => parseCsv("a,b\n1,2,3\n"), MarketDataError);
});

test("rejects empty input", () => {
  assert.throws(() => parseCsv(""), MarketDataError);
  assert.throws(() => parseCsv("\n\n"), MarketDataError);
});

test("parses bars with normalized symbols and ISO timestamps", () => {
  const bars = parseBarsCsv(
    "symbol,timestamp,open,high,low,close,volume\n" +
      "aapl,2024-01-02,10,11,9,10.5,1000\n" +
      "AAPL,2024-01-03T00:00:00Z,10.5,12,10,11.5,1200\n",
  );
  assert.equal(bars.length, 2);
  assert.equal(bars[0]?.symbol, "AAPL");
  assert.equal(bars[0]?.timestamp, Date.UTC(2024, 0, 2));
  assert.equal(bars[0]?.adjusted, false);
  assert.equal(bars[1]?.volume, 1200);
});

test("rejects invalid numbers and OHLC ordering at parse time only when present", () => {
  assert.throws(
    () => parseBarsCsv("symbol,timestamp,open,high,low,close,volume\nAAPL,2024-01-02,10,11,9,10.5,nope\n"),
    MarketDataError,
  );
  assert.throws(
    () => parseBarsCsv("symbol,timestamp,open,high,low,close,volume\nAAPL,2024-01-02,10,11,9,10.5,\n"),
    MarketDataError,
  );
});

test("parses universe metadata with defaults", () => {
  const assets = parseUniverseCsv(
    "symbol,name,asset_class,currency,listed_at,delisted_at,sector\n" +
      "AAPL,Apple,,,2020-01-01,2024-01-01,Technology\n" +
      "BTC/USD,Bitcoin,crypto,USD,,,\n",
  );
  assert.equal(assets.length, 2);
  assert.equal(assets[0]?.name, "Apple");
  assert.equal(assets[0]?.assetClass, "equity");
  assert.equal(assets[0]?.currency, "USD");
  assert.equal(assets[0]?.listedAt, Date.UTC(2020, 0, 1));
  assert.equal(assets[1]?.symbol, "BTC/USD");
  assert.equal(assets[1]?.assetClass, "crypto");
  assert.equal(assets[1]?.listedAt, null);
});

test("parses split and cash dividend actions", () => {
  const actions = parseActionsCsv(
    "kind,symbol,ex_date,ratio,amount\n" +
      "split,AAPL,2024-01-02,2,\n" +
      "cash_dividend,AAPL,2024-02-01,,0.25\n",
  );
  assert.equal(actions.length, 2);
  assert.deepEqual(actions[0], {
    kind: "split",
    symbol: "AAPL",
    exDate: Date.UTC(2024, 0, 2),
    ratio: 2,
  });
  assert.deepEqual(actions[1], {
    kind: "cash_dividend",
    symbol: "AAPL",
    exDate: Date.UTC(2024, 1, 1),
    amount: 0.25,
  });
});

test("rejects invalid actions and missing required columns", () => {
  assert.throws(
    () => parseActionsCsv("kind,symbol,ex_date,ratio\nforward,AAPL,2024-01-02,2\n"),
    MarketDataError,
  );
  assert.throws(
    () => parseActionsCsv("kind,symbol,ex_date,ratio\nsplit,AAPL,2024-01-02,\n"),
    MarketDataError,
  );
  assert.throws(
    () => parseUniverseCsv("name\nApple\n"),
    MarketDataError,
  );
});