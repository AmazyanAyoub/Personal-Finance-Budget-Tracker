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
