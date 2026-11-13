import type { Bar, CorporateAction } from "./domain.ts";
import { MarketDataError } from "./errors.ts";
import { validateActions, validateBars } from "./validate.ts";

function actionKey(symbol: string, timestamp: number): string {
  return `${symbol}\u0000${timestamp}`;
}

export function adjustBars(
  bars: readonly Bar[],
  actions: readonly CorporateAction[],
  asOf = Number.POSITIVE_INFINITY,
): Bar[] {
  validateBars(bars);
  validateActions(actions);

  if (asOf !== Number.POSITIVE_INFINITY && !Number.isSafeInteger(asOf)) {
    throw new MarketDataError(
      "invalid_filter",
      `asOf must be an integer number of milliseconds or positive infinity: ${asOf}`,
      { field: "as_of" },
    );
  }

  const exDateClose = new Map<string, number>();
  for (const bar of bars) {
    exDateClose.set(actionKey(bar.symbol, bar.timestamp), bar.close);
  }

  const actionsBySymbol = new Map<string, CorporateAction[]>();
  for (const action of actions) {
    if (action.exDate > asOf) {
      continue;
    }
    const symbolActions = actionsBySymbol.get(action.symbol);
    if (symbolActions === undefined) {
      actionsBySymbol.set(action.symbol, [action]);
      continue;
    }
    symbolActions.push(action);
  }

  const adjusted: Bar[] = [];
  for (const bar of bars) {
    if (bar.timestamp > asOf) {
      throw new MarketDataError(
        "future_bar",
        `Bar is after asOf for ${bar.symbol}`,
        { symbol: bar.symbol, timestamp: bar.timestamp, field: "timestamp" },
      );
    }

    let priceFactor = 1;
    let volumeFactor = 1;
    const symbolActions = actionsBySymbol.get(bar.symbol);
    if (symbolActions !== undefined) {
      for (const action of symbolActions) {
        if (action.exDate <= bar.timestamp) {
          continue;
        }
        if (action.kind === "split") {
          priceFactor /= action.ratio;
          volumeFactor *= action.ratio;
          continue;
        }

        const exClose = exDateClose.get(
          actionKey(action.symbol, action.exDate),
        );
        if (exClose === undefined) {
          throw new MarketDataError(
            "missing_ex_date_bar",
            `Missing ex-date bar for ${action.symbol} at ${new Date(action.exDate).toISOString()}`,
            { symbol: action.symbol, timestamp: action.exDate },
          );
        }
        if (exClose <= action.amount) {
          throw new MarketDataError(
            "invalid_action",
            `Dividend amount must be less than the ex-date close for ${action.symbol}`,
            { symbol: action.symbol, timestamp: action.exDate, field: "amount" },
          );
        }
        priceFactor *= (exClose - action.amount) / exClose;
      }
    }

    adjusted.push({
      symbol: bar.symbol,
      timestamp: bar.timestamp,
      open: bar.open * priceFactor,
      high: bar.high * priceFactor,
      low: bar.low * priceFactor,
      close: bar.close * priceFactor,
      volume: bar.volume * volumeFactor,
      adjusted: true,
    });
  }
  return adjusted;
}