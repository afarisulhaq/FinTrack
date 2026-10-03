"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { formatAmountInput, parseAmountInput } from "~/lib/amount-input";

export const AmountInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(
  (
    { value, defaultValue, onChange, onKeyDown, min, max, step, ...props },
    ref,
  ) => (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={value === undefined ? undefined : formatAmountInput(String(value))}
      defaultValue={
        defaultValue === undefined
          ? undefined
          : formatAmountInput(String(defaultValue))
      }
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const input = event.currentTarget;
        const cursor = input.selectionStart;
        if (cursor === null || cursor !== input.selectionEnd) return;
        if (event.key === "Backspace" && input.value[cursor - 1] === ".") {
          input.setSelectionRange(cursor - 1, cursor - 1);
        } else if (event.key === "Delete" && input.value[cursor] === ".") {
          input.setSelectionRange(cursor + 1, cursor + 1);
        }
      }}
      onChange={(event) => {
        const input = event.currentTarget;
        const before = input.value;
        const cursor = input.selectionStart ?? before.length;
        const raw = parseAmountInput(before);
        const formatted = formatAmountInput(raw);
        const count = before.slice(0, cursor).replace(/\./g, "").length;
        const numeric = Number(raw);
        let message = "";
        if (raw && !Number.isFinite(numeric))
          message = "Masukkan nominal yang valid.";
        else if (raw && min !== undefined && numeric < Number(min))
          message = `Nominal minimal ${formatAmountInput(String(min))}.`;
        else if (raw && max !== undefined && numeric > Number(max))
          message = `Nominal maksimal ${formatAmountInput(String(max))}.`;
        else if (raw && step !== undefined && step !== "any") {
          const units = (numeric - Number(min ?? 0)) / Number(step);
          if (Math.abs(units - Math.round(units)) > 1e-7)
            message = `Gunakan kelipatan ${formatAmountInput(String(step))}.`;
        }
        input.setCustomValidity(message);
        input.value = raw;
        onChange?.(event);
        input.value = formatted;
        let position = 0;
        let consumed = 0;
        while (position < formatted.length && consumed < count) {
          if (formatted[position] !== ".") consumed++;
          position++;
        }
        input.setSelectionRange(position, position);
      }}
    />
  ),
);
AmountInput.displayName = "AmountInput";
