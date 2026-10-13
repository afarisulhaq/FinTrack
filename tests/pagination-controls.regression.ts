import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pagination } from "../src/components/ui/pagination";

Object.defineProperty(globalThis, "React", { value: React, configurable: true });
const small = renderToStaticMarkup(React.createElement(Pagination, {
  page: 1, pageSize: 10, total: 10, totalPages: 1,
  onPageChange: () => { throw new Error("render must not change page"); },
  onPageSizeChange: () => { throw new Error("render must not change size"); },
}));
assert.equal(small, "", "ten records need no pagination UI");
const multiplePages = renderToStaticMarkup(React.createElement(Pagination, {
  page: 1, pageSize: 10, total: 11, totalPages: 2,
  onPageChange: () => { throw new Error("render must not change page"); },
  onPageSizeChange: () => { throw new Error("render must not change size"); },
}));
assert.ok(multiplePages.includes("<nav"));
assert.deepEqual([...multiplePages.matchAll(/<option value="(\d+)"/g)].map((match) => Number(match[1])), [10, 50, 100, 200]);
assert.equal([...multiplePages.matchAll(/<button\b/g)].length, 4);
const largePage = renderToStaticMarkup(React.createElement(Pagination, {
  page: 1, pageSize: 50, total: 11, totalPages: 1,
  onPageChange: () => { throw new Error("render must not change page"); },
  onPageSizeChange: () => { throw new Error("render must not change size"); },
}));
assert.ok(largePage.includes("<select"), "keep size selection so users can return to smaller pages");
assert.ok(!largePage.includes("<button"), "one page needs no disabled navigation controls");
console.log("PASS: 10/11 visibility boundary, 10/50/100/200 choices, single-page selector without redundant arrows");
