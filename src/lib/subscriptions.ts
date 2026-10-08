export interface SubscriptionInvoice {
  id: string;
  planName: string;
  baseAmount: number;
  amount: number;
  uniqueAmount: number;
  durationDays: number;
  status: string;
  qrisCode: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
}

export interface BillingOverview {
  available: boolean;
  plan: { name: string; price: number; durationDays: number } | null;
  subscription: { plan: string; active: boolean; expiresAt: string } | null;
  invoices: SubscriptionInvoice[];
}
