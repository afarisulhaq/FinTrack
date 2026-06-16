// ─── Wallet ────────────────────────────────────────────────────────────────────

export type WalletType =
  | "bank"
  | "cash"
  | "e-wallet"
  | "investment"
  | "savings";

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  parentId?: string;
  children?: Wallet[];
  isArchived?: boolean;
}

// ─── Transaction ───────────────────────────────────────────────────────────────

export type TransactionType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  categoryIcon: string;
  walletId: string;
  walletName: string;
  description: string;
  date: string; // ISO string
  tags?: string[];
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringId?: string;
  /// FK refs to the master Category / SubCategory. Both optional so legacy
  /// rows keep loading. Server keeps `category` in sync with the master
  /// name on create/update.
  categoryId?: string;
  subCategoryId?: string;
}

// ─── Master Category & Sub-Category ────────────────────────────────────────────

export type CategoryKind = "income" | "expense" | "transfer";

export interface SubCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  type: CategoryKind;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  subCategories: SubCategory[];
  createdAt: string;
  updatedAt: string;
}

// ─── Budget ────────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  category: string;
  categoryIcon: string;
  limit: number;
  spent: number;
  period: "daily" | "weekly" | "monthly";
  color: string;
  walletId?: string;
  /// Master Category + SubCategory FKs. The `category` string stays in
  /// sync (server-side) so existing match-by-name lookups in transaction
  /// deltas keep working without migration.
  categoryId?: string;
  subCategoryId?: string;
}

// ─── Investment ────────────────────────────────────────────────────────────────

export type AssetClass = "stock" | "crypto" | "gold" | "mutual-fund" | "bond";

export interface Investment {
  id: string;
  name: string;
  symbol: string;
  assetClass: AssetClass;
  broker: string;
  /// Lots currently held. The "is this position open?" check is
  /// `quantity > 0`. A position with sellPrice set and quantity > 0
  /// is *partially* sold, not closed.
  quantity: number;
  /// Lots cumulatively sold across every sell event on this
  /// position. Zero for never-sold; equals the original buy
  /// amount when fully sold. Used to compute realized P/L on
  /// the "Terjual" tab.
  soldQuantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  color: string;
  /// Details of the most recent sell event (price, fee, date).
  /// Stays set after a partial sell so the row can still show
  /// "you sold at Rp X on date Y".
  sellPrice: number | null;
  soldAt: string | null;
  /// Server-only field for the sell action. The frontend sends
  /// this on the update call; the backend reads it, reduces
  /// `quantity` and bumps `soldQuantity` accordingly, then ignores
  /// it on subsequent reads. Optional everywhere else.
  sellQuantity?: number;
  buyFee: number | null;
  sellFee: number | null;
}

// ─── Bill ──────────────────────────────────────────────────────────────────────

export type BillStatus = "unpaid" | "paid" | "overdue";

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  category: string;
  icon: string;
  isRecurring?: boolean;
  recurringPeriod?: "monthly" | "yearly";
  walletId?: string;
  categoryId?: string;
}

// ─── Saving Goal ───────────────────────────────────────────────────────────────

export interface SavingGoal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
  walletId?: string;
  autoSave?: boolean;
  autoSaveAmount?: number;
}

// ─── Debt ──────────────────────────────────────────────────────────────────────

export type DebtDirection = "owe" | "lent";

export interface DebtInstallment {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface Debt {
  id: string;
  direction: DebtDirection;
  personName: string;
  personContact?: string;
  amount: number;
  paidAmount: number;
  dueDate?: string;
  description: string;
  installments: DebtInstallment[];
  isSettled: boolean;
  createdAt: string;
}

// ─── Split Bill ───────────────────────────────────────────────────────────

export type SplitMethod = "equal" | "percentage" | "custom";
export type SplitBillStatus = "active" | "settled" | "cancelled";

export interface SplitBillParticipant {
  id: string;
  name: string;
  contact?: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
  /**
   * Public pay-link token. Anyone with the URL
   * `/pay/{billId}/{payToken}` can view the bill context and toggle this
   * participant as paid. Treat it like a password for that slot.
   */
  payToken?: string;
}

export interface SplitBill {
  id: string;
  title: string;
  description: string;
  totalAmount: number;
  currency: string;
  paidBy: string;
  date: string;
  splitMethod: SplitMethod;
  status: SplitBillStatus;
  participants: SplitBillParticipant[];
  createdAt: string;
  updatedAt: string;
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export type CardType = "credit" | "debit";

export interface Card {
  id: string;
  name: string;
  bank: string;
  type: CardType;
  last4Digits: string;
  limit?: number;
  used?: number;
  billingCycleStart: number;
  statementDate: number;
  dueDate: number;
  color: string;
  interestRate?: number;
}

// ─── Wishlist ──────────────────────────────────────────────────────────────────

export type WishlistPriority = "low" | "medium" | "high";

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  priority: WishlistPriority;
  category: string;
  url?: string;
  notes?: string;
  isPurchased: boolean;
  createdAt: string;
}

// ─── Reimbursement ─────────────────────────────────────────────────────────────

export type ReimbursementStatus = "active" | "settled";

export interface Reimbursement {
  id: string;
  title: string;
  amount: number;
  paidFrom: string; // walletId
  walletName: string;
  project?: string;
  company?: string;
  status: ReimbursementStatus;
  submittedDate: string;
  settledDate?: string;
  notes?: string;
  receiptUrl?: string;
}

// ─── Note ──────────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  color?: string;
}

// ─── Recurring Transaction ─────────────────────────────────────────────────────

export type RecurringPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  category: string;
  categoryIcon: string;
  walletId: string;
  period: RecurringPeriod;
  nextDate: string;
  isActive: boolean;
  categoryId?: string;
  subCategoryId?: string;
}

// ─── Dashboard / Chart Helpers ─────────────────────────────────────────────────

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface MonthlyChartData {
  month: string; // e.g. "Jan", "Feb"
  income: number;
  expense: number;
}

// ─── Gamification ──────────────────────────────────────────────────────────────

export type BadgeCategory =
  | "saving"
  | "budget"
  | "investment"
  | "streak"
  | "milestone";

export interface GamificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  color: string; // hex color for background
  category: BadgeCategory;
  isUnlocked: boolean;
  unlockedAt?: string; // ISO date string
  progress?: number; // 0–100, for badges not yet unlocked
  condition: string; // human-readable condition text
  xpReward: number; // XP points awarded on unlock
}

export interface HealthScoreBreakdown {
  savings: number; // 0–25: tabungan rate
  budget: number; // 0–25: budget adherence
  debt: number; // 0–25: debt-to-income
  investment: number; // 0–25: has investments
}

export interface GamificationState {
  totalXP: number;
  level: number; // 1–10, based on XP
  levelName: string; // "Pemula Finansial", "Penjaga Anggaran", etc.
  healthScore: number; // 0–100 composite
  breakdown: HealthScoreBreakdown;
  currentStreak: number; // consecutive days with expense recorded
  longestStreak: number;
  zeroSpendStreak: number; // consecutive zero-spend days
  totalZeroSpendDays: number;
  badges: GamificationBadge[];
  lastUpdated: string;
}

// ─── User Profile & Team ────────────────────────────────────────────────────────

export type UserRole = "owner" | "member" | "viewer";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string; // URL or base64
  currency: string; // 'IDR'
  language: string; // 'id'
  timezone: string; // 'Asia/Jakarta'
  monthlyIncome?: number;
  disposableIncome?: number;
  joinedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  permissions: {
    canViewAllWallets: boolean;
    canAddTransactions: boolean;
    canManageBudgets: boolean;
    walletIds: string[]; // specific wallet access
  };
  status: "active" | "invited" | "inactive";
  joinedAt: string;
  invitedAt?: string;
}

// ─── Notification Settings ──────────────────────────────────────────────────────

export type NotificationChannel = "whatsapp" | "telegram" | "email" | "push";

export interface NotificationSettings {
  channels: {
    whatsapp: { enabled: boolean; phone: string };
    telegram: { enabled: boolean; chatId: string; botToken: string };
    email: { enabled: boolean; address: string };
    push: { enabled: boolean };
  };
  preferences: {
    dailyReminder: boolean;
    dailyReminderTime: string; // "08:00"
    weeklyReport: boolean;
    weeklyReportDay: number; // 0=Sunday, 1=Monday, …
    monthlyReport: boolean;
    budgetAlert: boolean;
    budgetAlertThreshold: number; // percentage, e.g. 80
    billReminder: boolean;
    billReminderDays: number; // days before due date
    savingGoalUpdate: boolean;
    debtReminder: boolean;
    largeTransactionAlert: boolean;
    largeTransactionThreshold: number; // amount in IDR
  };
}
