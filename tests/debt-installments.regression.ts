import assert from "node:assert/strict";
import * as React from "react";
import { AmountInput } from "../src/components/ui/amount-input";

let deferred: () => void = () => {};
Object.defineProperty(globalThis, "React", {
  value: React,
  configurable: true,
});
let raw = "";
const input = {
  value: "",
  selectionStart: 0,
  setCustomValidity() {},
  setSelectionRange() {},
};
const element = (AmountInput as any).render(
  {
    value: "",
    onChange: (event: any) => {
      deferred = () => {
        raw = event.target.value;
      };
    },
  },
  null,
);
for (const digit of "1000000") {
  input.value += digit;
  input.selectionStart = input.value.length;
  element.props.onChange({ currentTarget: input, target: input });
  deferred();
}
assert.equal(input.value, "1.000.000");
assert.equal(
  raw,
  "1000000",
  "deferred React updater must receive the unformatted amount",
);
assert.equal(Number(raw), 1000000);
console.log("PASS: sequential rupiah typing and deferred updater raw value");

