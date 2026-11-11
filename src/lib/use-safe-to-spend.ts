"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { AnalyticsSummary } from "./analytics";
import { useAuthStore } from "~/store/useAuthStore";

/**
 * What the sidebar strip shows: how much of today's money is still free once
 * the bills that are already committed are taken off the top.
 *
 * The sidebar renders on all 23 dashboard routes, so the numbers come from one
 * cached call rather than a per-page fetch.
 */
export interface SafeToSpend {
  perDay: number;
  committed: number;
  unpaidCount: number;
  nextDueInDays: number | null;
  daysLeft: number;
}

interface Page<T> {
  summary: T;
}

const TTL = 60_000;
let cache: { at: number; value: SafeToSpend } | null = null;
let inflight: Promise<SafeToSpend | null> | null = null;

function daysBetween(iso: string, from: Date) {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86_400_000);
}

function derive(summary: AnalyticsSummary, now: Date): SafeToSpend {
  const thisMonth = summary.monthlyData[summary.monthlyData.length - 1];
  const income = thisMonth?.income ?? 0;
  const spent = thisMonth?.expense ?? 0;
  const unpaid = summary.bills.filter((bill) => bill.status !== "paid");
  const committed = unpaid.reduce((sum, bill) => sum + bill.amount, 0);

  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);

  const due = unpaid
    .map((bill) => daysBetween(bill.dueDate, now))
    .filter((n): n is number => n !== null && n >= 0);

  return {
    perDay: Math.max(0, Math.round((income - spent - committed) / daysLeft)),
    committed,
    unpaidCount: unpaid.length,
    nextDueInDays: due.length ? Math.min(...due) : null,
    daysLeft,
  };
}

function load(token: string): Promise<SafeToSpend | null> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.value);
  if (inflight) return inflight;
  inflight = api
    .get<Page<AnalyticsSummary>>("/analytics/summary?period=1", token)
    .then((page) => {
      const value = derive(page.summary, new Date());
      cache = { at: Date.now(), value };
      return value;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSafeToSpend() {
  const token = useAuthStore((s) => s.token);
  const [value, setValue] = useState<SafeToSpend | null>(cache?.value ?? null);

  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;
    if (cache && Date.now() - cache.at < TTL) {
      setValue(cache.value);
      return;
    }
    let live = true;
    void load(token).then((next) => {
      if (live && next) setValue(next);
    });
    return () => {
      live = false;
    };
  }, [token]);

  return value;
}
