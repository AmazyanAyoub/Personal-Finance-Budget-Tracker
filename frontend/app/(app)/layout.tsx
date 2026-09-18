"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getOnboardingStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";
import { Sidebar } from "../sidebar";

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = getToken();

  const {
    data: onboarding,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token!),
    enabled: !!token,
    retry: false,
  });

  const sessionExpired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (sessionExpired) {
      clearToken();
      router.replace("/login");
    } else if (onboarding && !onboarding.is_onboarded) {
      router.replace("/onboarding");
    }
  }, [sessionExpired, onboarding, router]);

  if (sessionExpired) {
    return <p className="p-6">Session expired. Redirecting to login...</p>;
  }

  if (isPending || (onboarding && !onboarding.is_onboarded)) {
    return <p className="p-6">Loading your account...</p>;
  }

  if (error) {
    return (
      <div className="p-6" role="alert">
        <p>Could not load your account. Check that the backend is running.</p>
        <button type="button" onClick={() => refetch()} className="underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 sm:p-10">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}