import type { Asset, Bar, UniverseExclusion, UniverseSnapshot } from "./domain.ts";
import { MarketDataError } from "./errors.ts";

export interface UniverseFilter {
  readonly lookbackDays: number;
  readonly minHistoryBars: number;
  readonly minAverageDollarVolume: number;
}

export const DEFAULT_UNIVERSE_FILTER: UniverseFilter = {
  lookbackDays: 365,
  minHistoryBars: 0,
  minAverageDollarVolume: 0,
};

export interface UniverseDataProvider {
  assets(): readonly Asset[];
  barsThrough(symbol: string, asOf: number): readonly Bar[];
}

function validateFilter(filter: UniverseFilter): number {
  if (!Number.isSafeInteger(filter.lookbackDays) || filter.lookbackDays < 0) {
    throw new MarketDataError(
      "invalid_filter",
      `lookbackDays must be a non-negative integer: ${filter.lookbackDays}`,
      { field: "lookbackDays" },
    );
  }
  if (
    !Number.isSafeInteger(filter.minHistoryBars) ||
    filter.minHistoryBars < 0
  ) {
    throw new MarketDataError(
      "invalid_filter",
      `minHistoryBars must be a non-negative integer: ${filter.minHistoryBars}`,
      { field: "minHistoryBars" },
    );
  }
  if (
    !Number.isFinite(filter.minAverageDollarVolume) ||
    filter.minAverageDollarVolume < 0
  ) {
    throw new MarketDataError(
      "invalid_filter",
      `minAverageDollarVolume must be a non-negative finite number: ${filter.minAverageDollarVolume}`,
      { field: "minAverageDollarVolume" },
    );
  }
  const lookbackMs = filter.lookbackDays * 86_400_000;
  if (!Number.isSafeInteger(lookbackMs)) {
    throw new MarketDataError(
      "invalid_filter",
      `lookbackDays is too large: ${filter.lookbackDays}`,
      { field: "lookbackDays" },
    );
  }
  return lookbackMs;
}

export function selectUniverse(
  provider: UniverseDataProvider,
  asOf: number,
  filter: UniverseFilter = DEFAULT_UNIVERSE_FILTER,
): UniverseSnapshot {
  if (!Number.isSafeInteger(asOf)) {
    throw new MarketDataError(
      "invalid_filter",
      `asOf must be an integer number of milliseconds: ${asOf}`,
      { field: "as_of" },
    );
  }
  const lookbackMs = validateFilter(filter);
  const lookbackStart = asOf - lookbackMs;
  const included: string[] = [];
  const excluded: UniverseExclusion[] = [];

  for (const asset of provider.assets()) {
    if (asset.listedAt !== null && asset.listedAt > asOf) {
      excluded.push({ symbol: asset.symbol, reason: "not_listed" });
      continue;
    }
    if (asset.delistedAt !== null && asset.delistedAt <= asOf) {
      excluded.push({ symbol: asset.symbol, reason: "delisted" });
      continue;
    }

    const bars = provider
      .barsThrough(asset.symbol, asOf)
      .filter((bar) => bar.timestamp >= lookbackStart);
    if (bars.length === 0) {
      excluded.push({ symbol: asset.symbol, reason: "no_data" });
      continue;
    }
    if (bars.length < filter.minHistoryBars) {
      excluded.push({ symbol: asset.symbol, reason: "insufficient_history" });
      continue;
    }

    if (filter.minAverageDollarVolume > 0) {
      const total = bars.reduce(
        (sum, bar) => sum + bar.close * bar.volume,
        0,
      );
      const average = total / bars.length;
      if (average < filter.minAverageDollarVolume) {
        excluded.push({ symbol: asset.symbol, reason: "insufficient_liquidity" });
        continue;
      }
    }

    included.push(asset.symbol);
  }

  included.sort((left, right) => left.localeCompare(right));
  excluded.sort((left, right) => left.symbol.localeCompare(right.symbol));
  return { asOf, symbols: included, excluded };
}