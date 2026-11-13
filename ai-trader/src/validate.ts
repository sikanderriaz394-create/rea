import {
  ASSET_CLASSES,
  type Asset,
  type Bar,
  type CorporateAction,
} from "./domain.ts";
import { MarketDataError } from "./errors.ts";

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,23}$/;
const CURRENCY_PATTERN = /^[A-Z]{3,5}$/;

function isValidSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol);
}

function validatePrice(
  bar: Bar,
  field: "open" | "high" | "low" | "close",
): void {
  const value = bar[field];
  if (!Number.isFinite(value) || value <= 0) {
    throw new MarketDataError(
      "invalid_bar",
      `${field} must be a finite positive number: ${value}`,
      { symbol: bar.symbol, timestamp: bar.timestamp, field },
    );
  }
}

export function validateBars(bars: readonly Bar[]): void {
  const seen = new Set<string>();
  const lastTimestamp = new Map<string, number>();

  for (const bar of bars) {
    if (!isValidSymbol(bar.symbol)) {
      throw new MarketDataError(
        "invalid_symbol",
        `Invalid bar symbol: ${bar.symbol}`,
        { symbol: bar.symbol },
      );
    }
    if (!Number.isSafeInteger(bar.timestamp)) {
      throw new MarketDataError(
        "invalid_timestamp",
        `Bar timestamp must be an integer number of milliseconds: ${bar.timestamp}`,
        { symbol: bar.symbol, timestamp: bar.timestamp },
      );
    }
    validatePrice(bar, "open");
    validatePrice(bar, "high");
    validatePrice(bar, "low");
    validatePrice(bar, "close");

    if (bar.high < bar.low) {
      throw new MarketDataError(
        "invalid_bar",
        "high must not be less than low",
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "high" },
      );
    }
    if (bar.high < bar.open || bar.high < bar.close) {
      throw new MarketDataError(
        "invalid_bar",
        "high must not be less than open or close",
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "high" },
      );
    }
    if (bar.low > bar.open || bar.low > bar.close) {
      throw new MarketDataError(
        "invalid_bar",
        "low must not be greater than open or close",
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "low" },
      );
    }
    if (!Number.isFinite(bar.volume) || bar.volume < 0) {
      throw new MarketDataError(
        "invalid_bar",
        `volume must be a finite non-negative number: ${bar.volume}`,
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "volume" },
      );
    }
    if (typeof bar.adjusted !== "boolean") {
      throw new MarketDataError(
        "invalid_bar",
        "adjusted must be a boolean",
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "adjusted" },
      );
    }

    const key = `${bar.symbol}\u0000${bar.timestamp}`;
    if (seen.has(key)) {
      throw new MarketDataError(
        "duplicate_bar",
        `Duplicate bar for ${bar.symbol} at ${new Date(bar.timestamp).toISOString()}`,
        { symbol: bar.symbol, timestamp: bar.timestamp },
      );
    }
    seen.add(key);

    const previous = lastTimestamp.get(bar.symbol);
    if (previous !== undefined && bar.timestamp <= previous) {
      throw new MarketDataError(
        "unsorted_bars",
        `Bars for ${bar.symbol} must be in strictly increasing timestamp order`,
        { symbol: bar.symbol, timestamp: bar.timestamp },
      );
    }
    lastTimestamp.set(bar.symbol, bar.timestamp);
  }
}

export function validateAssets(assets: readonly Asset[]): void {
  const seen = new Set<string>();

  for (const asset of assets) {
    if (!isValidSymbol(asset.symbol)) {
      throw new MarketDataError(
        "invalid_symbol",
        `Invalid asset symbol: ${asset.symbol}`,
        { symbol: asset.symbol, field: "symbol" },
      );
    }
    if (seen.has(asset.symbol)) {
      throw new MarketDataError(
        "duplicate_asset",
        `Duplicate asset: ${asset.symbol}`,
        { symbol: asset.symbol, field: "symbol" },
      );
    }
    seen.add(asset.symbol);

    if (asset.name.trim() === "") {
      throw new MarketDataError(
        "invalid_asset",
        `Asset name must not be empty: ${asset.symbol}`,
        { symbol: asset.symbol, field: "name" },
      );
    }
    if (!ASSET_CLASSES.includes(asset.assetClass)) {
      throw new MarketDataError(
        "invalid_asset",
        `Invalid asset class for ${asset.symbol}: ${asset.assetClass}`,
        { symbol: asset.symbol, field: "asset_class" },
      );
    }
    if (!CURRENCY_PATTERN.test(asset.currency)) {
      throw new MarketDataError(
        "invalid_asset",
        `Invalid currency for ${asset.symbol}: ${asset.currency}`,
        { symbol: asset.symbol, field: "currency" },
      );
    }
    if (
      asset.listedAt !== null &&
      !Number.isSafeInteger(asset.listedAt)
    ) {
      throw new MarketDataError(
        "invalid_asset",
        `Invalid listed date for ${asset.symbol}`,
        { symbol: asset.symbol, field: "listed_at" },
      );
    }
    if (
      asset.delistedAt !== null &&
      !Number.isSafeInteger(asset.delistedAt)
    ) {
      throw new MarketDataError(
        "invalid_asset",
        `Invalid delisted date for ${asset.symbol}`,
        { symbol: asset.symbol, field: "delisted_at" },
      );
    }
    if (
      asset.listedAt !== null &&
      asset.delistedAt !== null &&
      asset.delistedAt <= asset.listedAt
    ) {
      throw new MarketDataError(
        "invalid_asset",
        `Delisted date must be after listed date for ${asset.symbol}`,
        { symbol: asset.symbol, field: "delisted_at" },
      );
    }
  }
}

export function validateActions(actions: readonly CorporateAction[]): void {
  const seen = new Set<string>();

  for (const action of actions) {
    if (!isValidSymbol(action.symbol)) {
      throw new MarketDataError(
        "invalid_symbol",
        `Invalid action symbol: ${action.symbol}`,
        { symbol: action.symbol, field: "symbol" },
      );
    }
    if (!Number.isSafeInteger(action.exDate)) {
      throw new MarketDataError(
        "invalid_action",
        `Action ex-date must be an integer number of milliseconds: ${action.exDate}`,
        { symbol: action.symbol, timestamp: action.exDate, field: "ex_date" },
      );
    }

    const key = `${action.kind}\u0000${action.symbol}\u0000${action.exDate}`;
    if (seen.has(key)) {
      throw new MarketDataError(
        "duplicate_action",
        `Duplicate ${action.kind} action for ${action.symbol} at ${new Date(action.exDate).toISOString()}`,
        { symbol: action.symbol, timestamp: action.exDate },
      );
    }
    seen.add(key);

    if (action.kind === "split") {
      if (!Number.isFinite(action.ratio) || action.ratio <= 0) {
        throw new MarketDataError(
          "invalid_action",
          `Split ratio must be greater than zero: ${action.ratio}`,
          { symbol: action.symbol, field: "ratio" },
        );
      }
      continue;
    }

    if (!Number.isFinite(action.amount) || action.amount < 0) {
      throw new MarketDataError(
        "invalid_action",
        `Dividend amount must not be negative: ${action.amount}`,
        { symbol: action.symbol, field: "amount" },
      );
    }
  }
}