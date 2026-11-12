"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { CardHead } from "~/components/ui/card-head";
import { DynamicIcon } from "~/components/ui/dynamic-icon";
import { formatCurrency } from "~/lib/utils";
import type { Wallet } from "~/lib/types";

const TYPE_LABEL: Record<string, string> = {
  cash: "Tunai",
  bank: "Rekening bank",
  ewallet: "Dompet digital",
  credit: "Kartu kredit",
  investment: "Investasi",
  savings: "Tabungan",
  other: "Lainnya",
};

/**
 * A deck of the user's wallets, one physical card per account. The top card
 * carries the numbers; the two behind it exist only to say "there is more
 * than one account here", which is the fact a flat list hides.
 */
export function WalletStack({
  wallets,
  currency,
  loading,
}: {
  wallets: Wallet[];
  currency: string;
  loading?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const total = wallets.length;

  if (loading && total === 0) {
    return (
      <section className="card">
        <CardHead title="Dompet" />
        <p className="text-text-muted text-sm" role="status">
          Memuat dompet…
        </p>
      </section>
    );
  }

  if (total === 0) {
    return (
      <section className="card flex flex-col">
        <CardHead
          title="Dompet"
          subtitle="Belum ada dompet yang tercatat"
        />
        <Link
          href="/wallets"
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
        >
          Tambah dompet pertama <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const step = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const visible = wallets
    .map((wallet, position) => ({
      wallet,
      layer: (position - index + total) % total,
    }))
    .filter((entry) => entry.layer < 3);

  return (
    <section className="card flex flex-col">
      <CardHead
        title="Dompet"
        subtitle={`${total} akun aktif`}
        action={
          <Link
            href="/wallets"
            className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline md:min-h-0"
          >
            Kelola <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="relative mx-auto mt-6 aspect-[1.586] w-full max-w-[380px]">
        {visible.map(({ wallet, layer }) => {
          const isTop = layer === 0;
          return (
            <button
              key={wallet.id}
              type="button"
              tabIndex={isTop ? 0 : -1}
              aria-hidden={!isTop}
              onClick={() => step(1)}
              aria-label={
                isTop
                  ? `${wallet.name}, saldo ${formatCurrency(wallet.balance, false, currency)}. Ketuk untuk dompet berikutnya`
                  : undefined
              }
              className="card-face absolute inset-0 flex flex-col p-5 text-left transition-transform duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
              style={{
                zIndex: 30 - layer * 10,
                transform: `translateY(${layer * -12}px) scale(${1 - layer * 0.04})`,
                opacity: isTop ? 1 : 0.55,
                pointerEvents: isTop ? "auto" : "none",
                ["--face-tint" as string]: `color-mix(in oklab, ${wallet.color} 46%, transparent)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <DynamicIcon
                    name={wallet.icon}
                    className="h-4 w-4 shrink-0 opacity-90"
                  />
                  <span className="truncate text-sm font-semibold">
                    {wallet.name}
                  </span>
                </div>
                <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                  {TYPE_LABEL[wallet.type] ?? wallet.type}
                </span>
              </div>

              <span
                className="mt-auto text-2xl font-semibold tracking-tight tabular-nums"
                style={{ letterSpacing: "-0.01em" }}
              >
                {formatCurrency(wallet.balance, false, currency)}
              </span>
              <span
                className="mt-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: "var(--card-face-muted)" }}
              >
                {wallet.currency}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Dompet sebelumnya"
          className="text-text-secondary hover:bg-bg-elevated hover:text-text-primary flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-9 md:w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-1.5">
          {wallets.map((wallet, dot) => (
            <button
              key={wallet.id}
              type="button"
              onClick={() => setIndex(dot)}
              aria-label={`Tampilkan ${wallet.name}`}
              aria-current={dot === index % total}
              className="group flex h-11 flex-1 items-center md:h-6"
            >
              <span
                className={`h-1.5 w-full rounded-full transition-colors ${
                  dot === index % total
                    ? "bg-primary"
                    : "bg-border group-hover:bg-border-strong"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Dompet berikutnya"
          className="text-text-secondary hover:bg-bg-elevated hover:text-text-primary flex h-11 w-11 items-center justify-center rounded-md transition-colors md:h-9 md:w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
