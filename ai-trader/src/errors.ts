export type MarketDataErrorCode =
  | "invalid_csv"
  | "missing_column"
  | "duplicate_column"
  | "invalid_symbol"
  | "invalid_timestamp"
  | "invalid_number"
  | "invalid_bar"
  | "duplicate_bar"
  | "unsorted_bars"
  | "invalid_asset"
  | "duplicate_asset"
  | "invalid_action"
  | "duplicate_action"
  | "missing_ex_date_bar"
  | "future_bar"
  | "invalid_filter";

export interface MarketDataErrorDetails {
  readonly symbol?: string | undefined;
  readonly timestamp?: number | undefined;
  readonly field?: string | undefined;
  readonly line?: number | undefined;
}

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly symbol: string | undefined;
  readonly timestamp: number | undefined;
  readonly field: string | undefined;
  readonly line: number | undefined;

  constructor(
    code: MarketDataErrorCode,
    message: string,
    details: MarketDataErrorDetails = {},
  ) {
    super(message);
    this.name = "MarketDataError";
    this.code = code;
    this.symbol = details.symbol;
    this.timestamp = details.timestamp;
    this.field = details.field;
    this.line = details.line;
  }
}