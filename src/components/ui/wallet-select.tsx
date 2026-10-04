"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, CornerDownRight } from "lucide-react";
import { useId } from "react";
import { normalizeWalletTree } from "~/lib/wallets";
import type { Wallet } from "~/lib/types";
import { useFinanceStore } from "~/store/useFinanceStore";

export function WalletPicker({
  value,
  onChange,
  wallets,
  id,
  placeholder = "Pilih dompet",
  required = false,
  emptyLabel,
  excludeId,
  currency,
}: {
  value: string;
  onChange: (value: string) => void;
  wallets?: Wallet[];
  id?: string;
  placeholder?: string;
  required?: boolean;
  emptyLabel?: string;
  excludeId?: string;
  currency?: string;
}) {
  const storedWallets = useFinanceStore((state) => state.wallets);
  const rows: { wallet: Wallet; depth: number }[] = [];
  function visit(wallet: Wallet, depth: number) {
    if (wallet.id !== excludeId && (!currency || wallet.currency === currency))
      rows.push({ wallet, depth });
    wallet.children?.forEach((child) => visit(child, depth + 1));
  }
  normalizeWalletTree(wallets ?? storedWallets).forEach((wallet) =>
    visit(wallet, 0),
  );
  const selected = rows.find(({ wallet }) => wallet.id === value)?.wallet;
  return (
    <Select.Root
      value={selected ? value : emptyLabel ? "__empty__" : ""}
      onValueChange={(next) => onChange(next === "__empty__" ? "" : next)}
      required={required}
    >
      <Select.Trigger
        id={id}
        className="bg-bg-surface border-border text-text-primary focus-visible:ring-primary flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <Select.Value placeholder={placeholder}>
          {selected?.name ?? (emptyLabel || placeholder)}
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="text-text-secondary h-4 w-4 shrink-0" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="bg-bg-surface border-border text-text-primary pointer-events-auto z-[110] max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-56 overflow-hidden rounded-lg border shadow-md"
        >
          <Select.Viewport className="max-h-72 overflow-y-auto p-1">
            {emptyLabel && (
              <Select.Item
                value="__empty__"
                className="data-[highlighted]:bg-bg-elevated text-text-secondary rounded-md px-3 py-2 text-sm outline-none"
              >
                <Select.ItemText>{emptyLabel}</Select.ItemText>
              </Select.Item>
            )}
            {rows.map(({ wallet, depth }) => (
              <Select.Item
                key={wallet.id}
                value={wallet.id}
                textValue={wallet.name}
                style={{ paddingLeft: 12 + depth * 20 }}
                className="data-[highlighted]:bg-bg-elevated relative flex min-h-10 cursor-pointer items-center gap-2 rounded-md py-2 pr-8 text-sm outline-none"
              >
                {depth > 0 && (
                  <CornerDownRight
                    aria-hidden
                    className="text-text-muted h-3.5 w-3.5 shrink-0"
                  />
                )}
                <Select.ItemText>
                  <span className={depth === 0 ? "font-medium" : ""}>
                    {wallet.name}
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator className="absolute right-2">
                  <Check className="text-primary h-4 w-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
            {!rows.length && (
              <p className="text-text-secondary px-3 py-2 text-sm">
                Belum ada dompet yang tersedia. Tambahkan melalui menu Dompet.
              </p>
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function WalletSelect({
  value,
  onChange,
  label = "Dompet",
  excludeId,
  required = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  excludeId?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-text-secondary text-sm font-medium">
        {label}
      </label>
      <WalletPicker
        id={id}
        value={value}
        onChange={onChange}
        excludeId={excludeId}
        currency="IDR"
        required={required}
      />
    </div>
  );
}
