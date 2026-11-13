export const ASSET_CLASSES = ["equity", "etf", "crypto", "other"] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export interface Asset {
  readonly symbol: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly currency: string;
  readonly listedAt: number | null;
  readonly delistedAt: number | null;
  readonly sector: string | null;
}

export interface Bar {
  readonly symbol: string;
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly adjusted: boolean;
}

export interface SplitAction {
  readonly kind: "split";
  readonly symbol: string;
  readonly exDate: number;
  readonly ratio: number;
}

export interface CashDividendAction {
  readonly kind: "cash_dividend";
  readonly symbol: string;
  readonly exDate: number;
  readonly amount: number;
}

export type CorporateAction = SplitAction | CashDividendAction;

export interface UniverseExclusion {
  readonly symbol: string;
  readonly reason: string;
}

export interface UniverseSnapshot {
  readonly asOf: number;
  readonly symbols: readonly string[];
  readonly excluded: readonly UniverseExclusion[];
}