export interface BusinessDashboardTotals {
  income: number;
  expense: number;
  difference: number;
  marginPercent: number | null;
  transactionCount: number;
}

export interface BusinessDashboard {
  year: number;
  years: number[];
  timezone: string;
  businessId: string | null;
  businesses: { id: string; name: string }[];
  totals: BusinessDashboardTotals;
  monthly: (BusinessDashboardTotals & { month: number; label: string })[];
  contributions: (BusinessDashboardTotals & { id: string; name: string })[];
  recent: {
    id: string;
    businessId: string;
    businessName: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    date: string;
    walletName: string | null;
  }[];
}
