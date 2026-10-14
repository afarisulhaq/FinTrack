"use client";

import { useMemo, useState } from "react";
import { icons } from "lucide-react";
import { DynamicIcon } from "./dynamic-icon";
import { Modal } from "./modal";
import { Input } from "./input";
import { cn } from "~/lib/utils";

const iconNames = Object.keys(icons).sort();
const iconLabel = (name: string) => name.replace(/([a-z\d])([A-Z])/g, "$1 $2");

export function IconPicker({
  value,
  onChange,
  quickIcons,
  label = "Ikon",
}: {
  value: string;
  onChange: (value: string) => void;
  quickIcons: readonly string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const shortcuts = [...new Set([...quickIcons, ...(value ? [value] : [])])];
  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return iconNames.filter((name) => name.toLowerCase().includes(query));
  }, [search]);

  function choice(name: string, showName = false) {
    return (
      <button
        key={name}
        type="button"
        aria-label={`Pilih ikon ${iconLabel(name)}`}
        aria-pressed={value === name}
        title={iconLabel(name)}
        onClick={() => {
          onChange(name);
          if (showName) setOpen(false);
        }}
        className={cn(
          "text-text-secondary hover:bg-bg-elevated focus-visible:ring-primary flex min-h-11 min-w-11 items-center justify-center rounded-lg border p-2 focus-visible:ring-2 focus-visible:outline-none",
          showName ? "flex-col gap-1" : "h-11 w-11",
          value === name
            ? "bg-primary/10 border-primary text-text-primary"
            : "border-border",
        )}
      >
        <DynamicIcon name={name} aria-hidden className="h-5 w-5 shrink-0" />
        {showName && (
          <span className="max-w-full truncate text-xs">{iconLabel(name)}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-text-secondary text-sm font-medium">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {shortcuts.map((name) => choice(name))}
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setOpen(true);
          }}
          aria-haspopup="dialog"
          className="border-border text-text-primary hover:bg-bg-elevated focus-visible:ring-primary min-h-11 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          Lihat lainnya
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pilih ikon"
        description="Cari atau pilih ikon untuk catatan ini."
        size="lg"
        zIndex={110}
      >
        <div className="space-y-4">
          <Input
            label="Cari ikon"
            placeholder="Nama ikon, mis. Wallet atau Coffee"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <p role="status" className="text-text-secondary text-xs">
            {filtered.length} dari {iconNames.length} ikon
          </p>
          {filtered.length ? (
            <div className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-5">
              {filtered.map((name) => choice(name, true))}
            </div>
          ) : (
            <p className="text-text-secondary py-6 text-sm">
              Ikon tidak ditemukan. Coba nama lain atau kosongkan pencarian.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
