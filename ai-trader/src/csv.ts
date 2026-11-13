import {
  ASSET_CLASSES,
  type Asset,
  type AssetClass,
  type Bar,
  type CashDividendAction,
  type CorporateAction,
  type SplitAction,
} from "./domain.ts";
import { MarketDataError } from "./errors.ts";
import { parseTimestamp } from "./time.ts";

export interface CsvRow {
  readonly line: number;
  readonly values: readonly string[];
}

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly CsvRow[];
}

export function parseCsv(input: string): CsvTable {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: CsvRow[] = [];
  let values: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  let rowHasContent = false;
  let index = 0;

  const endField = (): void => {
    values.push(field);
    field = "";
  };

  const endRow = (): void => {
    endField();
    if (rowHasContent) {
      rows.push({ line: rowLine, values });
    }
    values = [];
    rowHasContent = false;
    rowLine = line;
  };

  while (index < text.length) {
    const char = text[index]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      if (char === "\r") {
        if (text[index + 1] === "\n") {
          index += 1;
        }
        line += 1;
        field += "\n";
        index += 1;
        continue;
      }
      if (char === "\n") {
        line += 1;
        field += "\n";
        index += 1;
        continue;
      }
      field += char;
      rowHasContent = true;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      rowHasContent = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      endField();
      rowHasContent = true;
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      endRow();
      line += 1;
      index += 1;
      rowLine = line;
      continue;
    }
    field += char;
    rowHasContent = true;
    index += 1;
  }

  if (inQuotes) {
    throw new MarketDataError("invalid_csv", "Unterminated quoted field", { line });
  }
  if (field !== "" || values.length > 0 || rowHasContent) {
    endRow();
  }
  if (rows.length === 0) {
    throw new MarketDataError("invalid_csv", "CSV is empty");
  }

  const headerRow = rows[0]!;
  const header = headerRow.values.map((name) => name.trim().toLowerCase());
  const seen = new Set<string>();
  for (const name of header) {
    if (name === "") {
      throw new MarketDataError(
        "invalid_csv",
        "CSV header contains an empty column",
        { line: headerRow.line },
      );
    }
    if (seen.has(name)) {
      throw new MarketDataError(
        "duplicate_column",
        `Duplicate CSV column: ${name}`,
        { field: name, line: headerRow.line },
      );
    }
    seen.add(name);
  }

  for (const row of rows.slice(1)) {
    if (row.values.length !== header.length) {
      throw new MarketDataError(
        "invalid_csv",
        `CSV row has ${row.values.length} columns; expected ${header.length}`,
        { line: row.line },
      );
    }
  }

  return { header, rows: rows.slice(1) };
}

function requireColumn(table: CsvTable, name: string): number {
  const index = table.header.indexOf(name);
  if (index < 0) {
    throw new MarketDataError("missing_column", `Missing required CSV column: ${name}`, {
      field: name,
      line: 1,
    });
  }
  return index;
}

function optionalColumn(table: CsvTable, name: string): number | undefined {
  const index = table.header.indexOf(name);
  return index < 0 ? undefined : index;
}

function cell(row: CsvRow, index: number, field: string): string {
  const value = row.values[index];
  if (value === undefined) {
    throw new MarketDataError(
      "invalid_csv",
      `Missing value for column: ${field}`,
      { field, line: row.line },
    );
  }
  return value;
}

function parseNumber(
  value: string,
  field: string,
  line: number,
): number {
  const text = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    throw new MarketDataError(
      "invalid_number",
      `Invalid number for ${field}: ${value}`,
      { field, line },
    );
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new MarketDataError(
      "invalid_number",
      `Number is not finite for ${field}: ${value}`,
      { field, line },
    );
  }
  return number;
}

function parsePositiveNumber(value: string, field: string, line: number): number {
  const number = parseNumber(value, field, line);
  if (number <= 0) {
    throw new MarketDataError(
      "invalid_number",
      `${field} must be greater than zero: ${value}`,
      { field, line },
    );
  }
  return number;
}

function parseNonNegativeNumber(value: string, field: string, line: number): number {
  const number = parseNumber(value, field, line);
  if (number < 0) {
    throw new MarketDataError(
      "invalid_number",
      `${field} must not be negative: ${value}`,
      { field, line },
    );
  }
  return number;
}

export function normalizeSymbol(value: string, line?: number): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,23}$/.test(symbol)) {
    throw new MarketDataError(
      "invalid_symbol",
      `Invalid symbol: ${value}`,
      { field: "symbol", line },
    );
  }
  return symbol;
}

export function parseBarsCsv(input: string): Bar[] {
  const table = parseCsv(input);
  const symbolAt = requireColumn(table, "symbol");
  const timestampAt = requireColumn(table, "timestamp");
  const openAt = requireColumn(table, "open");
  const highAt = requireColumn(table, "high");
  const lowAt = requireColumn(table, "low");
  const closeAt = requireColumn(table, "close");
  const volumeAt = requireColumn(table, "volume");

  const bars: Bar[] = [];
  for (const row of table.rows) {
    const symbol = normalizeSymbol(cell(row, symbolAt, "symbol"), row.line);
    const timestamp = parseTimestamp(
      cell(row, timestampAt, "timestamp"),
      "timestamp",
      row.line,
    );
    const open = parsePositiveNumber(cell(row, openAt, "open"), "open", row.line);
    const high = parsePositiveNumber(cell(row, highAt, "high"), "high", row.line);
    const low = parsePositiveNumber(cell(row, lowAt, "low"), "low", row.line);
    const close = parsePositiveNumber(cell(row, closeAt, "close"), "close", row.line);
    const volume = parseNonNegativeNumber(
      cell(row, volumeAt, "volume"),
      "volume",
      row.line,
    );
    bars.push({ symbol, timestamp, open, high, low, close, volume, adjusted: false });
  }
  return bars;
}

function parseAssetClass(
  value: string | undefined,
  line: number,
): AssetClass {
  const text = value?.trim().toLowerCase() ?? "";
  if (text === "") {
    return "equity";
  }
  if (!ASSET_CLASSES.includes(text as AssetClass)) {
    throw new MarketDataError(
      "invalid_asset",
      `Invalid asset class: ${value}`,
      { field: "asset_class", line },
    );
  }
  return text as AssetClass;
}

function parseCurrency(value: string | undefined, line: number): string {
  const text = value?.trim().toUpperCase() ?? "";
  if (text === "") {
    return "USD";
  }
  if (!/^[A-Z]{3,5}$/.test(text)) {
    throw new MarketDataError(
      "invalid_asset",
      `Invalid currency: ${value}`,
      { field: "currency", line },
    );
  }
  return text;
}

function optionalTimestamp(
  row: CsvRow,
  index: number | undefined,
  field: string,
): number | null {
  if (index === undefined) {
    return null;
  }
  const value = cell(row, index, field).trim();
  if (value === "") {
    return null;
  }
  return parseTimestamp(value, field, row.line);
}

export function parseUniverseCsv(input: string): Asset[] {
  const table = parseCsv(input);
  const symbolAt = requireColumn(table, "symbol");
  const nameAt = optionalColumn(table, "name");
  const assetClassAt = optionalColumn(table, "asset_class");
  const currencyAt = optionalColumn(table, "currency");
  const listedAtAt = optionalColumn(table, "listed_at");
  const delistedAtAt = optionalColumn(table, "delisted_at");
  const sectorAt = optionalColumn(table, "sector");

  const assets: Asset[] = [];
  for (const row of table.rows) {
    const symbol = normalizeSymbol(cell(row, symbolAt, "symbol"), row.line);
    const name = nameAt === undefined
      ? symbol
      : cell(row, nameAt, "name").trim() || symbol;
    const assetClass = parseAssetClass(
      assetClassAt === undefined ? undefined : cell(row, assetClassAt, "asset_class"),
      row.line,
    );
    const currency = parseCurrency(
      currencyAt === undefined ? undefined : cell(row, currencyAt, "currency"),
      row.line,
    );
    const listedAt = optionalTimestamp(row, listedAtAt, "listed_at");
    const delistedAt = optionalTimestamp(row, delistedAtAt, "delisted_at");
    const sector = sectorAt === undefined
      ? null
      : cell(row, sectorAt, "sector").trim() || null;

    if (listedAt !== null && delistedAt !== null && delistedAt <= listedAt) {
      throw new MarketDataError(
        "invalid_asset",
        `Delisted date must be after listed date for ${symbol}`,
        { symbol, line: row.line },
      );
    }
    assets.push({
      symbol,
      name,
      assetClass,
      currency,
      listedAt,
      delistedAt,
      sector,
    });
  }
  return assets;
}

export function parseActionsCsv(input: string): CorporateAction[] {
  const table = parseCsv(input);
  const kindAt = requireColumn(table, "kind");
  const symbolAt = requireColumn(table, "symbol");
  const exDateAt = requireColumn(table, "ex_date");
  const ratioAt = optionalColumn(table, "ratio");
  const amountAt = optionalColumn(table, "amount");

  const actions: CorporateAction[] = [];
  for (const row of table.rows) {
    const kind = cell(row, kindAt, "kind").trim().toLowerCase();
    const symbol = normalizeSymbol(cell(row, symbolAt, "symbol"), row.line);
    const exDate = parseTimestamp(cell(row, exDateAt, "ex_date"), "ex_date", row.line);

    if (kind === "split") {
      if (ratioAt === undefined) {
        throw new MarketDataError(
          "missing_column",
          "Split actions require a ratio column",
          { field: "ratio", line: row.line },
        );
      }
      const ratio = parsePositiveNumber(cell(row, ratioAt, "ratio"), "ratio", row.line);
      const action: SplitAction = { kind: "split", symbol, exDate, ratio };
      actions.push(action);
      continue;
    }

    if (kind === "cash_dividend") {
      if (amountAt === undefined) {
        throw new MarketDataError(
          "missing_column",
          "Cash dividend actions require an amount column",
          { field: "amount", line: row.line },
        );
      }
      const amount = parseNonNegativeNumber(
        cell(row, amountAt, "amount"),
        "amount",
        row.line,
      );
      const action: CashDividendAction = {
        kind: "cash_dividend",
        symbol,
        exDate,
        amount,
      };
      actions.push(action);
      continue;
    }

    throw new MarketDataError(
      "invalid_action",
      `Invalid corporate action kind: ${kind}`,
      { field: "kind", line: row.line },
    );
  }
  return actions;
}