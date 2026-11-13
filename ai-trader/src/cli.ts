import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseActionsCsv, parseBarsCsv, parseUniverseCsv } from "./csv.ts";
import { MarketDataError } from "./errors.ts";
import { MarketDataStore } from "./store.ts";
import { formatTimestamp, parseTimestamp } from "./time.ts";

export interface ValidateOptions {
  readonly bars: string;
  readonly universe: string | null;
  readonly actions: string | null;
  readonly asOf: number | null;
}

interface OptionResult {
  readonly value: string;
  readonly next: number;
}

function readOption(
  argv: readonly string[],
  index: number,
  name: string,
): OptionResult | null {
  const argument = argv[index];
  if (argument === name) {
    const value = argv[index + 1];
    if (value === undefined) {
      throw new MarketDataError(
        "invalid_csv",
        `Missing value for ${name}`,
        { field: name },
      );
    }
    return { value, next: index + 2 };
  }
  const prefix = `${name}=`;
  if (argument !== undefined && argument.startsWith(prefix)) {
    return { value: argument.slice(prefix.length), next: index + 1 };
  }
  return null;
}

export function parseValidateArgs(argv: readonly string[]): ValidateOptions {
  let bars: string | null = null;
  let universe: string | null = null;
  let actions: string | null = null;
  let asOf: string | null = null;

  let index = 0;
  while (index < argv.length) {
    const argument = argv[index]!;
    const barsOption = readOption(argv, index, "--bars");
    if (barsOption !== null) {
      bars = barsOption.value;
      index = barsOption.next;
      continue;
    }
    const universeOption = readOption(argv, index, "--universe");
    if (universeOption !== null) {
      universe = universeOption.value;
      index = universeOption.next;
      continue;
    }
    const actionsOption = readOption(argv, index, "--actions");
    if (actionsOption !== null) {
      actions = actionsOption.value;
      index = actionsOption.next;
      continue;
    }
    const asOfOption = readOption(argv, index, "--as-of");
    if (asOfOption !== null) {
      asOf = asOfOption.value;
      index = asOfOption.next;
      continue;
    }
    throw new MarketDataError(
      "invalid_csv",
      `Unknown argument: ${argument}`,
      { field: argument },
    );
  }

  if (bars === null) {
    throw new MarketDataError(
      "invalid_csv",
      "Usage: node src/cli.ts validate --bars <path> [--universe <path>] [--actions <path>] [--as-of <timestamp>]",
      { field: "--bars" },
    );
  }
  if (actions !== null && asOf === null) {
    throw new MarketDataError(
      "invalid_timestamp",
      "--as-of is required when --actions is provided",
      { field: "--as-of" },
    );
  }

  return {
    bars,
    universe,
    actions,
    asOf: asOf === null ? null : parseTimestamp(asOf, "as_of"),
  };
}

export function runCli(argv: readonly string[]): string {
  const command = argv[0];
  if (command !== "validate") {
    throw new MarketDataError(
      "invalid_csv",
      "Usage: node src/cli.ts validate --bars <path> [--universe <path>] [--actions <path>] [--as-of <timestamp>]",
      { field: command },
    );
  }

  const options = parseValidateArgs(argv.slice(1));
  const bars = parseBarsCsv(readFileSync(options.bars, "utf8"));
  if (bars.length === 0) {
    throw new MarketDataError(
      "invalid_csv",
      "No bars found",
      { field: "--bars" },
    );
  }
  const assets = options.universe === null
    ? []
    : parseUniverseCsv(readFileSync(options.universe, "utf8"));
  const actions = options.actions === null
    ? []
    : parseActionsCsv(readFileSync(options.actions, "utf8"));
  const store = new MarketDataStore(bars, assets, actions);

  let adjustedBars = 0;
  let adjustedSymbols = 0;
  if (options.asOf !== null) {
    for (const symbol of store.symbols()) {
      const visible = store.barsThrough(symbol, options.asOf, {
        adjusted: true,
      });
      if (visible.length > 0) {
        adjustedSymbols += 1;
      }
      adjustedBars += visible.length;
    }
  }

  const universe = options.asOf === null
    ? null
    : store.universe(options.asOf);

  const summary = {
    ok: true,
    bars: bars.length,
    symbols: store.symbols().length,
    assets: assets.length,
    actions: actions.length,
    firstTimestamp: store.firstTimestamp === null
      ? null
      : formatTimestamp(store.firstTimestamp),
    lastTimestamp: store.lastTimestamp === null
      ? null
      : formatTimestamp(store.lastTimestamp),
    asOf: options.asOf === null ? null : formatTimestamp(options.asOf),
    adjustedBars,
    adjustedSymbols,
    universe: universe === null
      ? null
      : {
          symbols: universe.symbols.length,
          excluded: universe.excluded.length,
        },
  };
  return JSON.stringify(summary, null, 2);
}

function errorPayload(error: unknown): string {
  if (error instanceof MarketDataError) {
    return JSON.stringify(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          symbol: error.symbol ?? null,
          timestamp: error.timestamp ?? null,
          field: error.field ?? null,
          line: error.line ?? null,
        },
      },
      null,
      2,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify(
    { ok: false, error: { code: "internal", message } },
    null,
    2,
  );
}

const entry = process.argv[1];
if (
  entry !== undefined &&
  import.meta.url === pathToFileURL(resolve(entry)).href
) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${errorPayload(error)}\n`);
    process.exitCode = 1;
  }
}