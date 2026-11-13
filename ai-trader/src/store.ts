import { adjustBars } from "./adjust.ts";
import type {
  Asset,
  Bar,
  CorporateAction,
  UniverseSnapshot,
} from "./domain.ts";
import { MarketDataError } from "./errors.ts";
import {
  DEFAULT_UNIVERSE_FILTER,
  selectUniverse,
  type UniverseFilter,
} from "./universe.ts";
import { validateActions, validateAssets, validateBars } from "./validate.ts";

export interface BarAccessOptions {
  readonly adjusted?: boolean;
}

function upperBound(bars: readonly Bar[], timestamp: number): number {
  let low = 0;
  let high = bars.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (bars[middle]!.timestamp <= timestamp) {
      low = middle + 1;
      continue;
    }
    high = middle;
  }
  return low;
}

function exactIndex(bars: readonly Bar[], timestamp: number): number {
  let low = 0;
  let high = bars.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const value = bars[middle]!.timestamp;
    if (value === timestamp) {
      return middle;
    }
    if (value < timestamp) {
      low = middle + 1;
      continue;
    }
    high = middle - 1;
  }
  return -1;
}

export class MarketDataStore {
  readonly #barsBySymbol: Map<string, readonly Bar[]>;
  readonly #assetsBySymbol: Map<string, Asset>;
  readonly #actionsBySymbol: Map<string, readonly CorporateAction[]>;
  readonly #symbols: readonly string[];
  readonly #firstTimestamp: number | null;
  readonly #lastTimestamp: number | null;

  constructor(
    bars: readonly Bar[],
    assets: readonly Asset[] = [],
    actions: readonly CorporateAction[] = [],
  ) {
    validateBars(bars);
    validateAssets(assets);
    validateActions(actions);

    const grouped = new Map<string, Bar[]>();
    for (const bar of bars) {
      const symbolBars = grouped.get(bar.symbol);
      if (symbolBars === undefined) {
        grouped.set(bar.symbol, [bar]);
        continue;
      }
      symbolBars.push(bar);
    }

    this.#barsBySymbol = grouped;
    this.#assetsBySymbol = new Map(
      assets.map((asset) => [asset.symbol, asset]),
    );
    const actionsBySymbol = new Map<string, CorporateAction[]>();
    for (const action of actions) {
      const symbolActions = actionsBySymbol.get(action.symbol);
      if (symbolActions === undefined) {
        actionsBySymbol.set(action.symbol, [action]);
        continue;
      }
      symbolActions.push(action);
    }
    this.#actionsBySymbol = actionsBySymbol;
    this.#symbols = [...grouped.keys()].sort((left, right) =>
      left.localeCompare(right),
    );

    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;
    for (const bar of bars) {
      if (firstTimestamp === null || bar.timestamp < firstTimestamp) {
        firstTimestamp = bar.timestamp;
      }
      if (lastTimestamp === null || bar.timestamp > lastTimestamp) {
        lastTimestamp = bar.timestamp;
      }
    }
    this.#firstTimestamp = firstTimestamp;
    this.#lastTimestamp = lastTimestamp;
  }

  symbols(): readonly string[] {
    return this.#symbols;
  }

  has(symbol: string): boolean {
    return this.#barsBySymbol.has(symbol);
  }

  asset(symbol: string): Asset | undefined {
    return this.#assetsBySymbol.get(symbol);
  }

  assets(): readonly Asset[] {
    return [...this.#assetsBySymbol.values()];
  }

  barsThrough(
    symbol: string,
    asOf: number,
    options: BarAccessOptions = {},
  ): readonly Bar[] {
    if (!Number.isSafeInteger(asOf)) {
      throw new MarketDataError(
        "invalid_timestamp",
        `asOf must be an integer number of milliseconds: ${asOf}`,
        { symbol, timestamp: asOf, field: "as_of" },
      );
    }

    const bars = this.#barsBySymbol.get(symbol);
    if (bars === undefined) {
      return [];
    }

    const visible = bars.slice(0, upperBound(bars, asOf));
    if (options.adjusted !== true) {
      return visible;
    }
    return adjustBars(
      visible,
      this.#actionsBySymbol.get(symbol) ?? [],
      asOf,
    );
  }

  latestBar(symbol: string, asOf: number): Bar | undefined {
    const visible = this.barsThrough(symbol, asOf);
    return visible[visible.length - 1];
  }

  barAt(symbol: string, timestamp: number): Bar | undefined {
    const bars = this.#barsBySymbol.get(symbol);
    if (bars === undefined) {
      return undefined;
    }
    const index = exactIndex(bars, timestamp);
    return index < 0 ? undefined : bars[index];
  }

  universe(
    asOf: number,
    filter: UniverseFilter = DEFAULT_UNIVERSE_FILTER,
  ): UniverseSnapshot {
    return selectUniverse(this, asOf, filter);
  }

  get firstTimestamp(): number | null {
    return this.#firstTimestamp;
  }

  get lastTimestamp(): number | null {
    return this.#lastTimestamp;
  }
}