"use client";

import * as Select from "@radix-ui/react-select";
import { useId } from "react";
import { flattenWalletTree } from "~/lib/wallets";
import { useFinanceStore } from "~/store/useFinanceStore";

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
  const tree = useFinanceStore((state) => state.wallets);
  const wallets = flattenWalletTree(tree).filter(
    (wallet) => wallet.currency === "IDR" && wallet.id !== excludeId,
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-text-secondary text-sm font-medium">
        {label}
      </label>
      <Select.Root
        value={wallets.some((wallet) => wallet.id === value) ? value : ""}
        onValueChange={onChange}
        required={required}
      >
        <Select.Trigger
          id={id}
          className="bg-bg-surface border-border text-text-primary focus-visible:ring-primary flex h-10 min-w-0 items-center justify-between rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="truncate">
            <Select.Value placeholder="Pilih dompet" />
          </span>
          <Select.Icon aria-hidden>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="bg-bg-surface border-border text-text-primary z-[110] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border shadow-md"
          >
            <Select.Viewport className="max-h-60 overflow-y-auto p-1">
              {wallets.map((wallet) => (
                <Select.Item
                  key={wallet.id}
                  value={wallet.id}
                  className="data-[highlighted]:bg-bg-elevated cursor-pointer rounded-md px-3 py-2 text-sm outline-none"
                >
                  <Select.ItemText>{wallet.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {wallets.length === 0 && (
        <p className="text-text-secondary text-xs">
          Belum ada dompet Rupiah yang tersedia. Tambahkan dompet melalui menu
          Dompet.
        </p>
      )}
    </div>
  );
}
