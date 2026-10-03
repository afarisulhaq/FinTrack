import assert from "node:assert/strict";
import { formatAmountInput, parseAmountInput } from "../src/lib/amount-input";
for (const [raw, display] of [
  ["", ""],
  ["0", "0"],
  ["1000", "1.000"],
  ["1000000", "1.000.000"],
  ["1234567.89", "1.234.567,89"],
  ["-1000000.5", "-1.000.000,5"],
  ["1000.", "1.000,"],
]) {
  assert.equal(formatAmountInput(raw!), display);
  assert.equal(parseAmountInput(display!), raw);
}
assert.equal(parseAmountInput("Rp 1.234.567,89"), "1234567.89");
assert.equal(parseAmountInput("000123"), "123");
console.log(
  "PASS: Indonesian grouping, decimals, negatives, empty fields, pasted currency",
);
