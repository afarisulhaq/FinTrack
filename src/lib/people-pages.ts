import type { Debt, DebtContact, SplitBill } from "./types.js";

export type DebtListRow = Omit<Debt, "installments"> & { installmentCount: number };
export interface DebtContactGroup {
  key: string;
  personName: string;
  personContact?: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  debtCount: number;
  activeCount: number;
}
export interface DebtSummary { totalOwe: number; totalLent: number; nett: number; }
export type ContactListRow = DebtContact & { oweTotal: number; lentTotal: number; };
export type SplitBillListRow = Omit<SplitBill, "participants"> & {
  participantCount: number;
  paidCount: number;
  collected: number;
  outstanding: number;
};
export interface SplitSummary { activeCount: number; totalCollected: number; totalOutstanding: number; }
export type DebtSnapshot = Debt | DebtListRow;
export type SplitBillSnapshot = SplitBill | SplitBillListRow;
