const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "headers"> & {
  token?: string;
  idempotencyKey?: string;
  headers?: HeadersInit;
};

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const message = (item as { msg?: unknown }).msg;
        return typeof message === "string" ? message : null;
      })
      .filter(Boolean);

    if (messages.length) return messages.join(", ");
  }

  return fallback;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, idempotencyKey, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);

  headers.set("Accept", "application/json");
  if (requestOptions.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(errorMessage(payload, `Request failed with status ${response.status}`), response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function withQuery(path: string, values: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });

  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export type TrackKind = "essentials" | "lifestyle" | "investments";
export type GoalStatus = "active" | "completed" | "archived";
export type DebtStatus = "active" | "paid" | "archived";
export type InvestmentAssetStatus = "active" | "sold" | "archived";
export type InvestmentAction = "buy" | "sell" | "dividend" | "fee" | "split" | "adjustment";
export type ValuationSource = "manual" | "market_api" | "estimated";
export type DecimalInput = number | string;

export type User = {
  id: number;
  email: string;
};

export type Token = {
  access_token: string;
  token_type: string;
};

export type FinancialProfile = {
  id: number;
  user_id: number;
  currency: string;
  expected_monthly_income_cents: number;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AllocationPlan = {
  id: number;
  user_id: number;
  essentials_pct: number;
  lifestyle_pct: number;
  investments_pct: number;
  effective_from: string;
  created_at: string;
};

export type Category = {
  id: number;
  user_id: number | null;
  name: string;
  track_kind: TrackKind;
  is_system: boolean;
  active: boolean;
};

export type MoneyEventType =
  | "opening_balance"
  | "income"
  | "expense"
  | "goal_reserve"
  | "goal_release"
  | "goal_spend"
  | "track_transfer"
  | "debt_payment"
  | "investment_buy"
  | "investment_sell"
  | "investment_income"
  | "investment_fee"
  | "balance_adjustment"
  | "reversal";

export type MoneyEvent = {
  id: number;
  user_id: number;
  event_type: MoneyEventType;
  cash_delta_cents: number;
  essentials_delta_cents: number;
  lifestyle_delta_cents: number;
  investments_delta_cents: number;
  category_id: number | null;
  goal_id: number | null;
  goal_delta_cents: number;
  debt_id: number | null;
  debt_delta_cents: number;
  occurred_on: string;
  note: string | null;
  idempotency_key: string | null;
  reverses_event_id: number | null;
  created_at: string;
};

export type Goal = {
  id: number;
  user_id: number;
  name: string;
  type_name: string;
  linked_track_kind: TrackKind;
  system_role: string | null;
  target_cents: number | null;
  target_date: string | null;
  status: GoalStatus;
  current_balance_cents: number;
  remaining_cents: number | null;
  progress_pct: number | null;
  created_at: string;
  updated_at: string;
};

export type Debt = {
  id: number;
  user_id: number;
  name: string;
  starting_balance_cents: number;
  current_balance_cents: number;
  amount_paid_cents: number;
  progress_pct: number;
  planned_monthly_payment_cents: number;
  target_date: string | null;
  status: DebtStatus;
  created_at: string;
};

export type InvestmentAsset = {
  id: number;
  user_id: number;
  asset_type: string;
  name: string;
  symbol: string | null;
  currency: string;
  status: InvestmentAssetStatus;
  current_units: string;
  current_value_cents: number | null;
  created_at: string;
};

export type InvestmentTransaction = {
  id: number;
  investment_asset_id: number;
  money_event_id: number | null;
  action: InvestmentAction;
  units_change: string;
  unit_price_cents: number | null;
  fees_cents: number;
  exchange_rate_to_profile: string | null;
  occurred_on: string;
  created_at: string;
};

export type InvestmentValuation = {
  id: number;
  investment_asset_id: number;
  price_per_unit_cents: number | null;
  total_value_cents: number | null;
  as_of_date: string;
  source: ValuationSource;
  created_at: string;
};

export type OnboardingStatus = {
  completed: boolean;
  completed_at: string | null;
};

export type OnboardingResult = {
  profile: FinancialProfile;
  allocation_plan: AllocationPlan;
  emergency_fund_goal: Goal;
  current_total_money_cents: number;
};

export type DashboardTrack = {
  track_kind: TrackKind;
  percentage: number;
  balance_cents: number;
};

export type DashboardGoal = {
  id: number;
  name: string;
  current_balance_cents: number;
  target_cents: number | null;
  progress_pct: number | null;
  status: GoalStatus;
};

export type DashboardDebt = {
  id: number;
  name: string;
  current_balance_cents: number;
  planned_monthly_payment_cents: number;
  progress_pct: number;
  status: DebtStatus;
};

export type DashboardInvestment = {
  id: number;
  name: string;
  asset_type: string;
  current_units: string;
  current_value_cents: number | null;
  status: InvestmentAssetStatus;
};

export type MonthlyActivity = {
  year: number;
  month: number;
  income_cents: number;
  expenses_cents: number;
  debt_payments_cents: number;
  investment_purchases_cents: number;
  investment_income_cents: number;
  net_money_change_cents: number;
};

export type SpendingCategory = {
  category_id: number;
  category_name: string;
  track_kind: TrackKind;
  amount_cents: number;
};

export type MonthlyTrendPoint = {
  year: number;
  month: number;
  money_in_cents: number;
  money_out_cents: number;
  closing_money_cents: number;
};

export type Dashboard = {
  as_of_date: string;
  currency: string;
  expected_monthly_income_cents: number;
  total_money_cents: number;
  money_in_tracks_cents: number;
  money_in_goals_cents: number;
  total_debt_cents: number;
  total_investment_value_cents: number;
  estimated_net_worth_cents: number;
  tracks: DashboardTrack[];
  monthly_activity: MonthlyActivity;
  goals: DashboardGoal[];
  debts: DashboardDebt[];
  investments: DashboardInvestment[];
  spending_by_category: SpendingCategory[];
  monthly_trend: MonthlyTrendPoint[];
  recent_events: MoneyEvent[];
};

export type OnboardingInput = {
  currency: string;
  expected_monthly_income_cents: number;
  essentials_pct: number;
  lifestyle_pct: number;
  investments_pct: number;
  emergency_fund_months: number;
  current_total_money_cents: number;
  current_emergency_fund_cents: number;
};

export type AllocationPlanInput = {
  essentials_pct: number;
  lifestyle_pct: number;
  investments_pct: number;
  effective_from: string;
};

export type IncomeInput = {
  name: string;
  amount_cents: number;
  occurred_on: string;
  note?: string | null;
};

export type ExpenseInput = {
  amount_cents: number;
  category_id: number;
  occurred_on: string;
  note?: string | null;
};

export type TrackTransferInput = {
  from_track: TrackKind;
  to_track: TrackKind;
  amount_cents: number;
  occurred_on: string;
  note?: string | null;
};

export type BalanceAdjustmentInput = {
  actual_total_money_cents: number;
  affected_track: TrackKind;
  occurred_on: string;
  reason: string;
};

export type EventCorrectionInput = {
  occurred_on: string;
  reason: string;
};

export type GoalInput = {
  name: string;
  type_name: string;
  linked_track_kind: TrackKind;
  target_cents?: number | null;
  target_date?: string | null;
};

export type GoalUpdateInput = Partial<GoalInput> & {
  status?: GoalStatus;
};

export type GoalMoneyInput = {
  amount_cents: number;
  occurred_on: string;
  note?: string | null;
};

export type DebtInput = {
  name: string;
  starting_balance_cents: number;
  planned_monthly_payment_cents?: number;
  target_date?: string | null;
};

export type DebtUpdateInput = {
  name?: string;
  planned_monthly_payment_cents?: number;
  target_date?: string | null;
  status?: "active" | "archived";
};

export type DebtPaymentInput = {
  amount_cents: number;
  occurred_on: string;
  note?: string | null;
};

export type InvestmentAssetInput = {
  asset_type: string;
  name: string;
  symbol?: string | null;
  currency?: string;
};

export type InvestmentAssetUpdateInput = {
  asset_type?: string;
  name?: string;
  symbol?: string | null;
  status?: "active" | "archived";
};

export type InvestmentTradeInput = {
  action: "buy" | "sell";
  units: DecimalInput;
  unit_price_cents: number;
  fees_cents?: number;
  exchange_rate_to_profile?: DecimalInput | null;
  occurred_on: string;
  note?: string | null;
};

export type InvestmentMoneyInput = {
  amount_cents: number;
  occurred_on: string;
  note?: string | null;
};

export type InvestmentUnitsInput = {
  action: "split" | "adjustment";
  units_change: DecimalInput;
  occurred_on: string;
};

export type InvestmentValuationInput = {
  price_per_unit_cents?: number | null;
  total_value_cents?: number | null;
  as_of_date: string;
};

export function getHealth() {
  return apiRequest<{ status: string }>("/health");
}

export function register(email: string, password: string) {
  return apiRequest<Token>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return apiRequest<Token>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string) {
  return apiRequest<User>("/auth/me", { token });
}

export function getOnboardingStatus(token: string) {
  return apiRequest<OnboardingStatus>("/onboarding/status", { token });
}

export function submitOnboarding(token: string, data: OnboardingInput) {
  return apiRequest<OnboardingResult>("/onboarding", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getFinancialProfile(token: string) {
  return apiRequest<FinancialProfile>("/settings/profile", { token });
}

export function updateFinancialProfile(
  token: string,
  data: Partial<Pick<FinancialProfile, "currency" | "expected_monthly_income_cents">>
) {
  return apiRequest<FinancialProfile>("/settings/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export function createAllocationPlan(token: string, data: AllocationPlanInput) {
  return apiRequest<AllocationPlan>("/settings/allocation-plans", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getCurrentAllocationPlan(token: string, onDate?: string) {
  return apiRequest<AllocationPlan>(
    withQuery("/settings/allocation-plans/current", { on_date: onDate }),
    { token }
  );
}

export function listAllocationPlans(token: string) {
  return apiRequest<AllocationPlan[]>("/settings/allocation-plans", { token });
}

export function listCategories(token: string, includeInactive = false) {
  return apiRequest<Category[]>(
    withQuery("/categories", { include_inactive: includeInactive }),
    { token }
  );
}

export function createCategory(
  token: string,
  data: { name: string; track_kind: TrackKind }
) {
  return apiRequest<Category>("/categories", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getCategory(token: string, categoryId: number) {
  return apiRequest<Category>(`/categories/${categoryId}`, { token });
}

export function updateCategory(
  token: string,
  categoryId: number,
  data: { name?: string; track_kind?: TrackKind; active?: boolean }
) {
  return apiRequest<Category>(`/categories/${categoryId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export function addIncome(
  token: string,
  data: IncomeInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<MoneyEvent>("/money/income", {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function addExpense(
  token: string,
  data: ExpenseInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<MoneyEvent>("/money/expenses", {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function transferBetweenTracks(
  token: string,
  data: TrackTransferInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<MoneyEvent>("/money/transfers", {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function adjustTotalBalance(
  token: string,
  data: BalanceAdjustmentInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<MoneyEvent>("/money/balance-adjustments", {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function reverseMoneyEvent(
  token: string,
  eventId: number,
  data: EventCorrectionInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<MoneyEvent>(`/money/events/${eventId}/reversal`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function getMoneyEvent(token: string, eventId: number) {
  return apiRequest<MoneyEvent>(`/money/events/${eventId}`, { token });
}

export function listMoneyEvents(
  token: string,
  filters: { startDate?: string; endDate?: string; limit?: number } = {}
) {
  return apiRequest<MoneyEvent[]>(
    withQuery("/money/events", {
      start_date: filters.startDate,
      end_date: filters.endDate,
      limit: filters.limit,
    }),
    { token }
  );
}

export function listGoals(token: string, includeArchived = false) {
  return apiRequest<Goal[]>(withQuery("/goals", { include_archived: includeArchived }), {
    token,
  });
}

export function createGoal(token: string, data: GoalInput) {
  return apiRequest<Goal>("/goals", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getGoal(token: string, goalId: number) {
  return apiRequest<Goal>(`/goals/${goalId}`, { token });
}

export function updateGoal(token: string, goalId: number, data: GoalUpdateInput) {
  return apiRequest<Goal>(`/goals/${goalId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

function goalMoneyAction(
  action: "reserve" | "release" | "spend",
  token: string,
  goalId: number,
  data: GoalMoneyInput,
  idempotencyKey: string
) {
  return apiRequest<Goal>(`/goals/${goalId}/${action}`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function reserveGoalMoney(
  token: string,
  goalId: number,
  data: GoalMoneyInput,
  idempotencyKey = newIdempotencyKey()
) {
  return goalMoneyAction("reserve", token, goalId, data, idempotencyKey);
}

export function releaseGoalMoney(
  token: string,
  goalId: number,
  data: GoalMoneyInput,
  idempotencyKey = newIdempotencyKey()
) {
  return goalMoneyAction("release", token, goalId, data, idempotencyKey);
}

export function spendGoalMoney(
  token: string,
  goalId: number,
  data: GoalMoneyInput,
  idempotencyKey = newIdempotencyKey()
) {
  return goalMoneyAction("spend", token, goalId, data, idempotencyKey);
}

export function listDebts(token: string, includeArchived = false) {
  return apiRequest<Debt[]>(withQuery("/debts", { include_archived: includeArchived }), {
    token,
  });
}

export function createDebt(token: string, data: DebtInput) {
  return apiRequest<Debt>("/debts", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getDebt(token: string, debtId: number) {
  return apiRequest<Debt>(`/debts/${debtId}`, { token });
}

export function updateDebt(token: string, debtId: number, data: DebtUpdateInput) {
  return apiRequest<Debt>(`/debts/${debtId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export function recordDebtPayment(
  token: string,
  debtId: number,
  data: DebtPaymentInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<Debt>(`/debts/${debtId}/payments`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function listInvestmentAssets(
  token: string,
  filters: { asOfDate?: string; includeArchived?: boolean } = {}
) {
  return apiRequest<InvestmentAsset[]>(
    withQuery("/investments", {
      as_of_date: filters.asOfDate,
      include_archived: filters.includeArchived,
    }),
    { token }
  );
}

export function createInvestmentAsset(token: string, data: InvestmentAssetInput) {
  return apiRequest<InvestmentAsset>("/investments", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function getInvestmentAsset(token: string, assetId: number, asOfDate?: string) {
  return apiRequest<InvestmentAsset>(
    withQuery(`/investments/${assetId}`, { as_of_date: asOfDate }),
    { token }
  );
}

export function updateInvestmentAsset(
  token: string,
  assetId: number,
  data: InvestmentAssetUpdateInput
) {
  return apiRequest<InvestmentAsset>(`/investments/${assetId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export function recordInvestmentTrade(
  token: string,
  assetId: number,
  data: InvestmentTradeInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<InvestmentTransaction>(`/investments/${assetId}/trades`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function recordInvestmentIncome(
  token: string,
  assetId: number,
  data: InvestmentMoneyInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<InvestmentTransaction>(`/investments/${assetId}/income`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function recordInvestmentFee(
  token: string,
  assetId: number,
  data: InvestmentMoneyInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<InvestmentTransaction>(`/investments/${assetId}/fees`, {
    method: "POST",
    token,
    idempotencyKey,
    body: JSON.stringify(data),
  });
}

export function recordInvestmentUnitsChange(
  token: string,
  assetId: number,
  data: InvestmentUnitsInput
) {
  return apiRequest<InvestmentTransaction>(`/investments/${assetId}/unit-changes`, {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function createInvestmentValuation(
  token: string,
  assetId: number,
  data: InvestmentValuationInput
) {
  return apiRequest<InvestmentValuation>(`/investments/${assetId}/valuations`, {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function listInvestmentTransactions(token: string, assetId: number) {
  return apiRequest<InvestmentTransaction[]>(
    `/investments/${assetId}/transactions`,
    { token }
  );
}

export function listInvestmentValuations(token: string, assetId: number) {
  return apiRequest<InvestmentValuation[]>(
    `/investments/${assetId}/valuations`,
    { token }
  );
}

export function reverseInvestmentTransaction(
  token: string,
  transactionId: number,
  data: EventCorrectionInput,
  idempotencyKey = newIdempotencyKey()
) {
  return apiRequest<InvestmentTransaction>(
    `/investments/transactions/${transactionId}/reversal`,
    {
      method: "POST",
      token,
      idempotencyKey,
      body: JSON.stringify(data),
    }
  );
}

export function getDashboard(token: string, asOfDate?: string) {
  return apiRequest<Dashboard>(
    withQuery("/dashboard", { as_of_date: asOfDate }),
    { token }
  );
}