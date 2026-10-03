import assert from "node:assert/strict";
import {
  businessSummary,
  formatBusinessReturn,
} from "../src/lib/business-summary";
const summary = businessSummary([
  { type: "expense", amount: 100000 },
  { type: "income", amount: 120000 },
]);
assert.deepEqual(summary, {
  income: 120000,
  expense: 100000,
  difference: 20000,
  returnPercent: 20,
});
assert.equal(businessSummary([]).returnPercent, null);
assert.equal(
  businessSummary([{ type: "income", amount: 50000 }]).returnPercent,
  null,
);
assert.equal(
  businessSummary([{ type: "expense", amount: 100000 }]).returnPercent,
  -100,
);
assert.equal(
  businessSummary([
    { type: "expense", amount: 100000 },
    { type: "income", amount: 50000 },
  ]).returnPercent,
  -50,
);
assert.equal(formatBusinessReturn(null), "Belum dapat dihitung");
assert.equal(formatBusinessReturn(20), "20%");
console.log(
  "PASS: business card totals, positive/negative results, zero-expense handling and percentage labels",
);
