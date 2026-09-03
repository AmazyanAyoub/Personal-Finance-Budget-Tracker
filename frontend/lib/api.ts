const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    current_budget_split: {
      id: number;
      freedom_funds_pct: number;
      essentials_pct: number;
      lifestyle_pct: number;
      effective_date: string;
    } | null;
  }>;
}


export type IncomeEntry = {
  id: number;
  source: "fixed" | "freelance";
  amount_cents: number;
  date: string;
  note: string | null;
  created_at: string;
};

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
