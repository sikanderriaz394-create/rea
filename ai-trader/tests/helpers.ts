import type { Asset, Bar, CorporateAction } from "../src/domain.ts";

export function bar(
  symbol: string,
  timestamp: number,
  close: number,
  volume = 100,
): Bar {
  return {
    symbol,
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume,
    adjusted: false,
  };
}

export function asset(
  symbol: string,
  overrides: Partial<Asset> = {},
): Asset {
  return {
    symbol,
    name: symbol,
    assetClass: "equity",
    currency: "USD",
    listedAt: null,
    delistedAt: null,
    sector: null,
    ...overrides,
  };
}

export function split(
  symbol: string,
  exDate: number,
  ratio: number,
): CorporateAction {
  return { kind: "split", symbol, exDate, ratio };
}

export function dividend(
  symbol: string,
  exDate: number,
  amount: number,
): CorporateAction {
  return { kind: "cash_dividend", symbol, exDate, amount };
}

export function day(dayOfMonth: number): number {
  return Date.UTC(2024, 0, dayOfMonth);
}