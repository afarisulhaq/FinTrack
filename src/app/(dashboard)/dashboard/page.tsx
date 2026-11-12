"use client";

import Link from "next/link";
import {
  TrendingUp,
  Bell,
  PiggyBank,
  CreditCard,
  Star,
  BarChart2,
  Layers,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { ServerListStatus } from "~/components/ui/server-paginated-list";
import { useServerPagination } from "~/lib/use-server-pagination";
import type { AnalyticsSummary } from "~/lib/analytics";
import type { Transaction, Wallet } from "~/lib/types";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { WalletStack } from "~/components/dashboard/wallet-stack";
import { NetWorthHero } from "~/components/dashboard/networth-hero";
import { CashflowTubes } from "~/components/dashboard/cashflow-tubes";
import { SpendSplit } from "~/components/dashboard/spend-split";
import { RecentPayments } from "~/components/dashboard/recent-payments";
import { InsightCard } from "~/components/dashboard/insight-card";
import { SavingGoals } from "~/components/dashboard/saving-goals";
import { UpcomingBills } from "~/components/dashboard/upcoming-bills";
import { KpiRow } from "~/components/dashboard/kpi-row";
import { BudgetsCard } from "~/components/dashboard/budgets-card";
import type { Budget } from "~/lib/types";

const QUICK_ACTIONS = [
  { href: "/investments", label: "Investasi", icon: TrendingUp },
  { href: "/bills", label: "Tagihan", icon: Bell },
  { href: "/savings", label: "Tabungan", icon: PiggyBank },
  { href: "/debts", label: "Utang", icon: Layers },
  { href: "/cards", label: "Kartu", icon: CreditCard },
  { href: "/wishlist", label: "Wishlist", icon: Star },
  { href: "/statistics", label: "Statistik", icon: BarChart2 },
];

/** Full month names, so the copy reads "November", not "Nov". */
function monthName(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString(
    "id-ID",
    { month: "long" },
  );
}

export default function DashboardPage() {
  const analytics = useServerPagination<never, AnalyticsSummary>(
    "/analytics/summary",
    { period: "6" },
  );
  const wallets = useServerPagination<Wallet>("/wallets", { view: "parents" }, {
    resource: "wallets",
    pageSize: 8,
  });
  const transactions = useServerPagination<Transaction>("/transactions", {}, {
    pageSize: 6,
  });
  const budgetPager = useServerPagination<
    Budget,
    { totalLimit: number; totalSpent: number; overspentCount: number }
  >("/budgets", { period: "monthly" }, { resource: "budgets", pageSize: 6 });

  const summary = analytics.summary;
  const currency = useAppConfigStore((s) => s.config.currency);
  const appName = useAppConfigStore((s) => s.config.appName);
  const tagline = useAppConfigStore((s) => s.config.tagline);

  const cash = summary?.walletBalance ?? 0;
  const portfolio = summary?.portfolioValue ?? 0;
  const monthlyData = summary?.monthlyData ?? [];
  const currentMonth = monthlyData[monthlyData.length - 1] ?? {
    month: "-",
    income: 0,
    expense: 0,
  };
  const previousMonth = monthlyData[monthlyData.length - 2] ?? {
    month: "-",
    income: 0,
    expense: 0,
  };

  const thisMonth = monthName(0);
  const lastMonth = monthName(-1);

  return (
    <PageWrapper title={appName} subtitle={tagline}>
      <ServerListStatus {...analytics} />
      {summary && (
        <>
          <KpiRow
            data={monthlyData}
            currency={currency}
            periodLabel={`Enam bulan terakhir sampai ${thisMonth}`}
          />

          <div className="page-grid grid-cols-1 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <WalletStack
                wallets={wallets.items}
                currency={currency}
                loading={wallets.loading}
              />
            </div>

            <div className="xl:col-span-7">
              <NetWorthHero
                netWorth={cash + portfolio}
                cash={cash}
                portfolio={portfolio}
                currency={currency}
                monthLabel={thisMonth}
                income={currentMonth.income}
                expense={currentMonth.expense}
                transactionCount={summary.transactionCount}
              />
            </div>

            <div className="xl:col-span-7">
              <CashflowTubes data={monthlyData} currency={currency} />
            </div>

            <div className="xl:col-span-5">
              <SpendSplit
                categories={summary.categories}
                currency={currency}
                monthLabel={thisMonth}
                previousExpense={previousMonth.expense}
                previousLabel={lastMonth}
              />
            </div>

            <div className="xl:col-span-5">
              <BudgetsCard
                budgets={budgetPager.items}
                totalLimit={budgetPager.summary?.totalLimit ?? 0}
                totalSpent={budgetPager.summary?.totalSpent ?? 0}
                overspentCount={budgetPager.summary?.overspentCount ?? 0}
                currency={currency}
                loading={budgetPager.loading}
              />
            </div>

            <div className="xl:col-span-7">
              <RecentPayments
                items={transactions.items}
                currency={currency}
                loading={transactions.loading}
              />
            </div>

            <div className="xl:col-span-4">
              <InsightCard
                categories={summary.categories}
                currency={currency}
                currentExpense={currentMonth.expense}
                previousExpense={previousMonth.expense}
                currentLabel={thisMonth}
                previousLabel={lastMonth}
              />
            </div>

            <div className="xl:col-span-4">
              <SavingGoals goals={summary.goals} currency={currency} />
            </div>

            <div className="xl:col-span-4">
              <UpcomingBills bills={summary.bills} currency={currency} />
            </div>
          </div>

          <div className="page-grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-surface-card text-text-secondary hover:text-text-primary flex min-h-11 items-center gap-2.5 rounded-md px-3 text-xs font-semibold transition-colors [box-shadow:inset_0_0_0_1px_var(--glass-rim)] hover:bg-bg-elevated"
                >
                  <Icon className="text-primary h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </PageWrapper>
  );
}
