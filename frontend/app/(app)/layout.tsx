"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getOnboardingStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";
import { Sidebar } from "../sidebar";

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = getToken();

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token!),
    enabled: !!token,
  });

  useEffect(() => {
    if (onboarding && !onboarding.is_onboarded) {
      router.replace("/onboarding");
    }
  }, [onboarding, router]);

  if (isLoading || (onboarding && !onboarding.is_onboarded)) {
    return null;
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
