const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Debt = {
  id: number;
  name: string;
  starting_balance_cents: number;
  current_balance_cents: number;
  monthly_payment_cents: number;
  payoff_target_date: string | null;
  total_paid_cents: number;
  progress_pct: number;
  is_paid_off: boolean;
  created_at: string;
};

export type Category = { id: number; name: string; bucket: "essentials" | "lifestyle" };

export type Expense = {
  id: number;
  amount_cents: number;
  note: string;
  date: string;
  category_id: number;
  created_at: string;
};

export type IncomeEntry = {
  id: number;
  source: "fixed" | "freelance";
  amount_cents: number;
  date: string;
  note: string | null;
  created_at: string;
};

export type BudgetEngineStatus = {
  year: number;
  month: number;
  monthly_income_cents: number;
  freedom_funds_cents: number;
  essentials_cents: number;
  lifestyle_cents: number;
  ef_target_cents: number;
  ef_current_balance_cents: number;
  ef_gap_cents: number;
  ef_is_met: boolean;
  projected_months_to_target: number | null;
  recommended_ef_cents: number;
  recommended_investments_cents: number;
  recommended_debt_cents: number;
};


export async function getHealth() {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<{ status: string }>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid email or password");
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function getMe(token: string) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json() as Promise<{ id: number; email: string }>;
}

export async function submitOnboarding(
  token: string,
  data: {
    income_mode: string;
    freedom_funds_pct: number;
    essentials_pct: number;
    lifestyle_pct: number;
    ef_multiplier: number;
    estimated_monthly_income_cents: number;
  }
) {
  const res = await fetch(`${API_URL}/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.[0]?.msg ?? body?.detail ?? "Onboarding failed");
  }
  return res.json();
}

export async function getOnboardingStatus(token: string) {
  const res = await fetch(`${API_URL}/onboarding/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load onboarding status");
  return res.json() as Promise<{
    is_onboarded: boolean;
    income_mode: string | null;
    ef_multiplier: number | null;
    ef_target_cents: number | null;
    current_budget_split: {
      id: number;
      freedom_funds_pct: number;
      essentials_pct: number;
      lifestyle_pct: number;
      effective_date: string;
    } | null;
  }>;
}


export async function listIncomeEntries(token: string, year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const res = await fetch(`${API_URL}/income-entries?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load income entries");
  return res.json() as Promise<IncomeEntry[]>;
}

export async function getMonthlyIncomeSummary(token: string, year: number, month: number) {
  const res = await fetch(`${API_URL}/income-entries/summary?year=${year}&month=${month}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load income summary");
  return res.json() as Promise<{
    year: number;
    month: number;
    total_cents: number;
    fixed_cents: number;
    freelance_cents: number;
    entry_count: number;
  }>;
}

export async function createIncomeEntry(
  token: string,
  data: { source: string; amount_cents: number; date: string; note?: string }
) {
  const res = await fetch(`${API_URL}/income-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.[0]?.msg ?? body?.detail ?? "Failed to create income entry");
  }
  return res.json();
}

export async function updateIncomeEntry(
  token: string,
  id: number,
  data: Partial<{ source: string; amount_cents: number; date: string; note: string }>
) {
  const res = await fetch(`${API_URL}/income-entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update income entry");
  return res.json();
}

export async function deleteIncomeEntry(token: string, id: number) {
  const res = await fetch(`${API_URL}/income-entries/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete income entry");
}


export async function listCategories(token: string) {
  const res = await fetch(`${API_URL}/categories`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

export async function listExpenses(token: string, year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const res = await fetch(`${API_URL}/expenses?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load expenses");
  return res.json() as Promise<Expense[]>;
}

export async function getMonthlyExpenseSummary(token: string, year: number, month: number) {
  const res = await fetch(`${API_URL}/expenses/summary?year=${year}&month=${month}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load expense summary");
  return res.json() as Promise<{
    year: number;
    month: number;
    total_cents: number;
    essentials_cents: number;
    lifestyle_cents: number;
    entry_count: number;
  }>;
}

export async function createExpense(
  token: string,
  data: { amount_cents: number; note: string; date: string; category_id: number }
) {
  const res = await fetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.[0]?.msg ?? body?.detail ?? "Failed to create expense");
  }
  return res.json();
}

export async function updateExpense(
  token: string,
  id: number,
  data: Partial<{ amount_cents: number; note: string; date: string; category_id: number }>
) {
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update expense");
  return res.json();
}

export async function deleteExpense(token: string, id: number) {
  const res = await fetch(`${API_URL}/expenses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete expense");
}


export async function getBudgetEngineStatus(token: string) {
  const res = await fetch(`${API_URL}/budget-engine/status`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load budget engine status");
  return res.json() as Promise<BudgetEngineStatus>;
}

export async function updateEfBalance(token: string, current_balance_cents: number) {
  const res = await fetch(`${API_URL}/budget-engine/ef-balance`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_balance_cents }),
  });
  if (!res.ok) throw new Error("Failed to update EF balance");
  return res.json() as Promise<BudgetEngineStatus>;
}

export type FreedomFundsAllocation = { investments_pct: number; debt_pct: number };

export async function getFreedomFundsAllocation(token: string) {
  const res = await fetch(`${API_URL}/budget-engine/freedom-funds-allocation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load allocation");
  return res.json() as Promise<FreedomFundsAllocation>;
}

export async function setFreedomFundsAllocation(token: string, data: FreedomFundsAllocation) {
  const res = await fetch(`${API_URL}/budget-engine/freedom-funds-allocation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.[0]?.msg ?? body?.detail ?? "Failed to save allocation");
  }
  return res.json() as Promise<FreedomFundsAllocation>;
}

export type DebtPayment = { id: number; debt_id: number; amount_cents: number; date: string; note: string | null; created_at: string };

export async function listDebts(token: string) {
  const res = await fetch(`${API_URL}/debts`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load debts");
  return res.json() as Promise<Debt[]>;
}

export async function createDebt(
  token: string,
  data: { name: string; balance_cents: number; monthly_payment_cents: number; payoff_target_date?: string }
) {
  const res = await fetch(`${API_URL}/debts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail?.[0]?.msg ?? body?.detail ?? "Failed to create debt");
  }
  return res.json() as Promise<Debt>;
}

export async function deleteDebt(token: string, id: number) {
  const res = await fetch(`${API_URL}/debts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to delete debt");
}

export async function logDebtPayment(token: string, debtId: number, data: { amount_cents: number; date: string; note?: string }) {
  const res = await fetch(`${API_URL}/debts/${debtId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to log payment");
  return res.json() as Promise<Debt>;
}

export async function listDebtPayments(token: string, debtId: number) {
  const res = await fetch(`${API_URL}/debts/${debtId}/payments`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to load payments");
  return res.json() as Promise<DebtPayment[]>;
}
