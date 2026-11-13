import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function run(args: readonly string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
  });
}

test("validates a complete dataset and prints a summary", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ai-trader-cli-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  const bars = join(directory, "bars.csv");
  const universe = join(directory, "universe.csv");
  const actions = join(directory, "actions.csv");
  writeFileSync(
    bars,
    "symbol,timestamp,open,high,low,close,volume\n" +
      "AAPL,2024-01-01,10,10,10,10,100\n" +
      "AAPL,2024-01-02,10,10,10,10,100\n",
  );
  writeFileSync(universe, "symbol,name\nAAPL,Apple\n");
  writeFileSync(actions, "kind,symbol,ex_date,ratio\nsplit,AAPL,2024-01-02,2\n");

  const result = run([
    "validate",
    "--bars",
    bars,
    "--universe",
    universe,
    "--actions",
    actions,
    "--as-of",
    "2024-01-02",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.bars, 2);
  assert.equal(summary.symbols, 1);
  assert.equal(summary.assets, 1);
  assert.equal(summary.actions, 1);
  assert.equal(summary.adjustedBars, 2);
  assert.equal(summary.universe.symbols, 1);
});

test("reports structured validation errors", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ai-trader-cli-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  const bars = join(directory, "bars.csv");
  writeFileSync(bars, "symbol,timestamp,open,high,low,close,volume\n");

  const result = run(["validate", "--bars", bars]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "invalid_csv");
});

test("requires --as-of with actions", () => {
  const result = run([
    "validate",
    "--bars",
    "missing.csv",
    "--actions",
    "missing.csv",
  ]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.error.code, "invalid_timestamp");
});