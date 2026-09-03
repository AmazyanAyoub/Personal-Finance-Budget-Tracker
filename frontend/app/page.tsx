"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getHealth, getMe, getOnboardingStatus } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { AuthGuard } from "./auth-guard";

function HomeContent() {
  const router = useRouter();
  const token = getToken();

  const { data: health } = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(token!),
    enabled: !!token,
  });
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token!),
    enabled: !!token,
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Personal Finance & Budget Tracker</h1>
      <p>Backend status: {health?.status ?? "checking..."}</p>
      <p>Logged in as: {me?.email ?? "..."}</p>
      {onboarding?.current_budget_split && (
        <p className="text-sm text-gray-500">
          Split: {onboarding.current_budget_split.freedom_funds_pct}% Freedom /{" "}
          {onboarding.current_budget_split.essentials_pct}% Essentials /{" "}
          {onboarding.current_budget_split.lifestyle_pct}% Lifestyle — EF target:{" "}
          {onboarding.ef_multiplier}x
        </p>
      )}
      <button onClick={handleLogout} className="border rounded px-3 py-2">
        Log out
      </button>
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
