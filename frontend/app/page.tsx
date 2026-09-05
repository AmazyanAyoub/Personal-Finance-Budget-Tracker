"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getBudgetEngineStatus, getHealth, getMe, getOnboardingStatus } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { AuthGuard } from "./auth-guard";

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function HomeContent() {
  const router = useRouter();
  const token = getToken();

  const { data: health } = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe(token!), enabled: !!token });
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token!),
    enabled: !!token,
  });
  const { data: engineStatus } = useQuery({
    queryKey: ["budget-engine-status"],
    queryFn: () => getBudgetEngineStatus(token!),
    enabled: !!token && !!onboarding?.is_onboarded,
  });

  useEffect(() => {
    if (onboarding && !onboarding.is_onboarded) {
      router.replace("/onboarding");
    }
  }, [onboarding, router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (onboardingLoading || (onboarding && !onboarding.is_onboarded)) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Personal Finance & Budget Tracker</h1>
      <p>Backend status: {health?.status ?? "checking..."}</p>
      <p>Logged in as: {me?.email ?? "..."}</p>
      {onboarding?.current_budget_split && (
        <p className="text-sm text-gray-500">
          Split: {onboarding.current_budget_split.freedom_funds_pct}% Freedom /{" "}
          {onboarding.current_budget_split.essentials_pct}% Essentials /{" "}
          {onboarding.current_budget_split.lifestyle_pct}% Lifestyle — EF target: {onboarding.ef_multiplier}x
        </p>
      )}

      {engineStatus && !engineStatus.ef_is_met && (
        <div className="bg-yellow-100 text-yellow-800 border border-yellow-300 rounded px-4 py-2 text-sm max-w-md text-center">
          Emergency Fund: {fromCents(engineStatus.ef_current_balance_cents)} / {fromCents(engineStatus.ef_target_cents)} MAD.
          Put this month's Freedom Funds ({fromCents(engineStatus.freedom_funds_cents)} MAD) toward it.
          {engineStatus.projected_months_to_target !== null && ` ~${engineStatus.projected_months_to_target} months to go.`}
        </div>
      )}
      {engineStatus && engineStatus.ef_is_met && (
        <div className="bg-green-100 text-green-800 border border-green-300 rounded px-4 py-2 text-sm max-w-md text-center">
          Emergency Fund funded — this month's Freedom Funds split: {fromCents(engineStatus.recommended_investments_cents)} MAD Investments / {fromCents(engineStatus.recommended_debt_cents)} MAD Debt.
        </div>
      )}

      <div className="flex gap-4 flex-wrap justify-center">
        <a href="/income" className="underline">Manage Income</a>
        <a href="/expenses" className="underline">Manage Expenses</a>
        <a href="/debts" className="underline">Manage Debts</a>
        <a href="/emergency-fund" className="underline">Emergency Fund</a>
      </div>

      <button onClick={handleLogout} className="border rounded px-3 py-2">Log out</button>
    </main>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
